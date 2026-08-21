"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { InvoiceMemberSummary } from "@/lib/types";

/**
 * Live, sign-normalized per-member totals for one open invoice
 * (`household_invoice_summary`) — the only query that crosses into the
 * partner's transactions, so it's a SECURITY DEFINER RPC rather than a
 * table read. Wrapped here so one invoice's failure to load never takes
 * down the rest of the settlement screen: each invoice gets its own
 * loading/error/retry state instead of a single shared toast.
 */
export function useInvoiceSummary(invoiceId: string) {
  const supabase = useMemo(() => createClient(), []);
  const [summary, setSummary] = useState<InvoiceMemberSummary[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    supabase
      .rpc("household_invoice_summary", { p_invoice_id: invoiceId })
      .then(({ data, error }) => {
        if (cancelled) return;
        setLoading(false);
        if (error) {
          setError(error.message);
          return;
        }
        setSummary((data ?? []) as InvoiceMemberSummary[]);
      });

    return () => {
      cancelled = true;
    };
  }, [supabase, invoiceId, attempt]);

  return { summary, loading, error, retry };
}
