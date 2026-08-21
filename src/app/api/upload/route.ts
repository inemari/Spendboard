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
  const creditInvoiceLabel = formData.get("creditInvoiceLabel");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }

  if (typeof cardType !== "string" || !CARD_TYPES.includes(cardType as CardType)) {
    return NextResponse.json({ error: "Invalid or missing card type." }, { status: 400 });
  }

  const requestedInvoiceLabel =
    typeof creditInvoiceLabel === "string" ? creditInvoiceLabel.trim() : null;
  const hasInvoiceId = typeof creditInvoiceId === "string" && creditInvoiceId.length > 0;
  const hasInvoiceLabel = typeof creditInvoiceLabel === "string";

  if (hasInvoiceId && hasInvoiceLabel) {
    return NextResponse.json(
      { error: "Choose an existing invoice or create a new one, not both." },
      { status: 400 },
    );
  }

  if (hasInvoiceLabel && !requestedInvoiceLabel) {
    return NextResponse.json({ error: "Invoice name is required." }, { status: 400 });
  }

  if (requestedInvoiceLabel && requestedInvoiceLabel.length > 120) {
    return NextResponse.json(
      { error: "Invoice name must be 120 characters or fewer." },
      { status: 400 },
    );
  }

  if (cardType !== "credit" && (hasInvoiceId || hasInvoiceLabel)) {
    return NextResponse.json(
      { error: "Only credit-card statements can be filed under an invoice." },
      { status: 400 },
    );
  }

  // Never trust invoice details from the client at face value. Existing ids
  // must belong to the uploader's household, and new invoices are created for
  // that verified household rather than a client-provided household id.
  let resolvedInvoiceId: string | null = null;
  let invoiceHouseholdId: string | null = null;
  if (hasInvoiceId || requestedInvoiceLabel) {
    const { data: membership, error: membershipError } = await supabase
      .from("household_members")
      .select("household_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: "You must belong to a household to file transactions under an invoice." },
        { status: 400 },
      );
    }
    invoiceHouseholdId = membership.household_id;

    if (hasInvoiceId) {
      const { data: invoice } = await supabase
        .from("credit_invoices")
        .select("id, household_id")
        .eq("id", creditInvoiceId as string)
        .maybeSingle();

      if (!invoice || invoice.household_id !== membership.household_id) {
        return NextResponse.json({ error: "Invalid invoice." }, { status: 400 });
      }

      const { data: settlement } = await supabase
        .from("settlements")
        .select("status")
        .eq("invoice_id", invoice.id)
        .maybeSingle();
      if (settlement?.status === "completed") {
        return NextResponse.json(
          { error: "Completed settlements are frozen and cannot receive more transactions." },
          { status: 409 },
        );
      }
      resolvedInvoiceId = invoice.id;
    }
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

  // Creating the invoice here (after the file has parsed successfully) avoids
  // empty invoice rows when the file picker is cancelled or the file is not a
  // supported statement. It also lets the picker open directly from the
  // user's Continue click instead of after a client-side network request.
  if (requestedInvoiceLabel && invoiceHouseholdId) {
    const { data: invoice, error: invoiceError } = await supabase
      .from("credit_invoices")
      .insert({ household_id: invoiceHouseholdId, label: requestedInvoiceLabel })
      .select("id")
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json(
        { error: invoiceError?.message ?? "Failed to create invoice." },
        { status: 500 },
      );
    }
    resolvedInvoiceId = invoice.id;
  }

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

  // Statements imported before invoice support already have matching rows,
  // so the conflict-safe upsert above deliberately skips them. Filing that
  // same statement now should attach those unfiled rows to the selected
  // invoice without overwriting any categorization or moving rows that are
  // already filed under another invoice.
  let attachedToInvoice = 0;
  if (resolvedInvoiceId) {
    const { count: attachedCount, error: attachmentError } = await supabase
      .from("transactions")
      .update({ credit_invoice_id: resolvedInvoiceId }, { count: "exact" })
      .in("month_id", Array.from(monthIdByKey.values()))
      .in("source_hash", parsed.map((t) => t.sourceHash))
      .is("credit_invoice_id", null);

    if (attachmentError) {
      return NextResponse.json({ error: attachmentError.message }, { status: 500 });
    }
    attachedToInvoice = attachedCount ?? 0;
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
    attached: attachedToInvoice,
    inserted: inserted ?? [],
  });
}
