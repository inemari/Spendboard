/**
 * Settlement math — deliberately the only place this arithmetic lives on the
 * client. `mark_settlement_paid` in supabase/schema.sql mirrors the same two
 * formulas when it freezes a completed settlement server-side (it has to:
 * only the database can see both members' transactions), but every other
 * reader (the live open-invoice view, the overview list's estimate) goes
 * through here so there's exactly one place to get the split logic right.
 */

export type MemberSpend = {
  userId: string;
  /** Positive spend magnitude for this member's Personal transactions on
   *  the invoice — already sign-normalized by the caller (see
   *  household_invoice_summary, which sums expenses as positive amounts the
   *  same way src/lib/overview.ts does). */
  personalTotal: number;
  /** Same normalization, for Common transactions. */
  commonTotal: number;
};

export type MemberShare = {
  userId: string;
  personalTotal: number;
  /** Combined common spend divided evenly across every member. */
  commonShare: number;
  /** personalTotal + commonShare, before subtracting any contribution. */
  transferBeforeContribution: number;
};

export function computeSettlementShares(members: MemberSpend[]): {
  commonTotal: number;
  commonShare: number;
  perMember: MemberShare[];
} {
  const commonTotal = members.reduce((sum, m) => sum + m.commonTotal, 0);
  const commonShare = members.length > 0 ? commonTotal / members.length : 0;

  return {
    commonTotal,
    commonShare,
    perMember: members.map((m) => ({
      userId: m.userId,
      personalTotal: m.personalTotal,
      commonShare,
      transferBeforeContribution: m.personalTotal + commonShare,
    })),
  };
}

/** Total responsibility − monthly prepaid contribution. Can go negative
 *  (the member has already prepaid more than they owe) — callers should
 *  display the true sign rather than taking the absolute value. */
export function remainingToTransfer(transferBeforeContribution: number, contribution: number): number {
  return transferBeforeContribution - contribution;
}
