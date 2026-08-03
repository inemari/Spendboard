import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseTransactionFile } from "@/lib/parse-transactions";

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

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
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

  const rows = parsed.map((t) => ({
    month_id: monthRow.id,
    date: t.date,
    description: t.description,
    amount: t.amount,
    source_hash: t.sourceHash,
    raw_row: t.rawRow,
  }));

  // ignoreDuplicates: re-uploading the same file must not clobber transactions
  // the user has already categorized (matched by month_id + source_hash).
  const { error: insertError, count } = await supabase
    .from("transactions")
    .upsert(rows, { onConflict: "month_id,source_hash", ignoreDuplicates: true, count: "exact" });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ imported: count ?? rows.length, total: rows.length });
}
