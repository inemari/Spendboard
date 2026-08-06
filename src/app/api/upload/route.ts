import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseTransactionFile } from "@/lib/parse-transactions";
import { categoryIdForTransaction } from "@/lib/apply-rules";
import type { CardType, Rule } from "@/lib/types";

const CARD_TYPES: CardType[] = ["credit", "debit"];

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month"));

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "Invalid year/month." }, { status: 400 });
  }

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

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }

  if (typeof cardType !== "string" || !CARD_TYPES.includes(cardType as CardType)) {
    return NextResponse.json({ error: "Invalid or missing card type." }, { status: 400 });
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

  const { data: monthRow, error: monthError } = await supabase
    .from("months")
    .upsert({ year, month }, { onConflict: "user_id,year,month" })
    .select("id")
    .single();

  if (monthError || !monthRow) {
    return NextResponse.json(
      { error: monthError?.message ?? "Failed to create month." },
      { status: 500 },
    );
  }

  const { data: rules } = await supabase
    .from("rules")
    .select("id, category_id, created_at, conditions");

  const rows = parsed.map((t) => ({
    month_id: monthRow.id,
    date: t.date,
    description: t.description,
    location: t.location,
    amount: t.amount,
    source_hash: t.sourceHash,
    raw_row: t.rawRow,
    category_id: categoryIdForTransaction(t.description, t.location, (rules ?? []) as Rule[]),
    card_type: cardType as CardType,
  }));

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
    .select("id, month_id, date, description, location, notes, amount, category_id, type, card_type");

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
      .eq("month_id", monthRow.id)
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
