import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseTransactionFile } from "@/lib/parse-transactions";
import { matchingRuleFor } from "@/lib/apply-rules";
import type { CardType, Rule } from "@/lib/types";

const CARD_TYPES: CardType[] = ["credit", "debit"];

/** "2026-07-15" -> { year: 2026, month: 7 } */
function monthOf(isoDate: string): { year: number; month: number } {
  const [year, month] = isoDate.split("-").map(Number);
  return { year, month };
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const cardType = formData.get("cardType");
  const creditInvoiceId = formData.get("creditInvoiceId");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }

  if (typeof cardType !== "string" || !CARD_TYPES.includes(cardType as CardType)) {
    return NextResponse.json({ error: "Invalid or missing card type." }, { status: 400 });
  }

  // Never trust an invoice id from the client at face value — it must belong
  // to a household the uploader is actually a member of, otherwise anyone
  // could tag their own transactions onto another household's invoice and
  // skew that household's shared common total.
  let resolvedInvoiceId: string | null = null;
  if (typeof creditInvoiceId === "string" && creditInvoiceId) {
    const { data: membership } = await supabase
      .from("household_members")
      .select("household_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const { data: invoice } = membership
      ? await supabase
          .from("credit_invoices")
          .select("id, household_id")
          .eq("id", creditInvoiceId)
          .maybeSingle()
      : { data: null };

    if (!membership || !invoice || invoice.household_id !== membership.household_id) {
      return NextResponse.json({ error: "Invalid invoice." }, { status: 400 });
    }
    resolvedInvoiceId = invoice.id;
  }

  let parsed;
  try {
    parsed = await parseTransactionFile(file);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to parse file.";
    return NextResponse.json({ error: message }, { status: 422 });
  }

  if (parsed.length === 0) {
    return NextResponse.json(
      { error: "No valid transactions found in the file." },
      { status: 422 },
    );
  }

  // A file is filed month-by-month, from each transaction's own date — not
  // under one month picked from the page the upload started from. There is no
  // such page any more (the overview can be showing any span), and stamping a
  // whole statement with one month is what used to strand a credit-card
  // period's July rows under August.
  const monthKeys = Array.from(
    new Map(parsed.map((t) => [t.date.slice(0, 7), monthOf(t.date)])).values(),
  );

  const { data: monthRows, error: monthError } = await supabase
    .from("months")
    .upsert(monthKeys, { onConflict: "user_id,year,month" })
    .select("id, year, month");

  if (monthError || !monthRows) {
    return NextResponse.json(
      { error: monthError?.message ?? "Failed to create month." },
      { status: 500 },
    );
  }

  const monthIdByKey = new Map(
    monthRows.map((m) => [`${m.year}-${String(m.month).padStart(2, "0")}`, m.id as string]),
  );

  const { data: rules } = await supabase
    .from("rules")
    .select("id, category_id, created_at, conditions, type, is_default");

  const rows = parsed.map((t) => {
    const matchedRule = matchingRuleFor(t.description, t.location, (rules ?? []) as Rule[]);
    return {
      month_id: monthIdByKey.get(t.date.slice(0, 7))!,
      date: t.date,
      description: t.description,
      location: t.location,
      amount: t.amount,
      source_hash: t.sourceHash,
      raw_row: t.rawRow,
      category_id: matchedRule?.category_id ?? null,
      // Omitted entirely (rather than passed as null) when no rule sets a
      // type, so the column's own `default 'personal'` applies exactly as
      // it did before this field existed on a rule.
      ...(matchedRule?.type ? { type: matchedRule.type } : {}),
      card_type: cardType as CardType,
      credit_invoice_id: resolvedInvoiceId,
    };
  });

  // ignoreDuplicates: re-uploading the same file must not clobber transactions
  // the user has already categorized (matched by month_id + source_hash).
  // Conflicting (already-existing) rows are skipped entirely, so `.select()`
  // here returns exactly the rows that were newly inserted.
  const {
    data: inserted,
    error: insertError,
    count,
  } = await supabase
    .from("transactions")
    .upsert(rows, { onConflict: "month_id,source_hash", ignoreDuplicates: true, count: "exact" })
    .select(
      "id, month_id, date, description, location, notes, amount, category_id, type, card_type, credit_invoice_id",
    );

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // The upsert above never touches rows that already exist, so it can't fill in
  // `location` for transactions imported before "Sted" column parsing existed.
  // Backfill just that field on re-upload, without touching category/type/notes.
  const parsedLocationByHash = new Map(
    parsed.filter((t) => t.location).map((t) => [t.sourceHash, t.location]),
  );

  if (parsedLocationByHash.size > 0) {
    const { data: existingWithoutLocation } = await supabase
      .from("transactions")
      .select("id, source_hash")
      .in("month_id", Array.from(monthIdByKey.values()))
      .is("location", null)
      .in("source_hash", Array.from(parsedLocationByHash.keys()));

    for (const row of existingWithoutLocation ?? []) {
      const location = parsedLocationByHash.get(row.source_hash);
      if (location) {
        await supabase.from("transactions").update({ location }).eq("id", row.id);
      }
    }
  }

  return NextResponse.json({
    imported: count ?? rows.length,
    total: rows.length,
    inserted: inserted ?? [],
  });
}
