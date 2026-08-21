import { describe, expect, it } from "vitest";
import { computeSettlementShares, remainingToTransfer } from "./settlement";

describe("computeSettlementShares", () => {
  it("matches the worked example from the product spec", () => {
    const result = computeSettlementShares([
      { userId: "sara", personalTotal: 1500, commonTotal: 1200 },
      { userId: "max", personalTotal: 1300, commonTotal: 800 },
    ]);

    expect(result.commonTotal).toBe(2000);
    expect(result.commonShare).toBe(1000);

    const sara = result.perMember.find((m) => m.userId === "sara")!;
    const max = result.perMember.find((m) => m.userId === "max")!;
    expect(sara.transferBeforeContribution).toBe(2500);
    expect(max.transferBeforeContribution).toBe(2300);
  });

  it("handles zero common spending", () => {
    const result = computeSettlementShares([
      { userId: "a", personalTotal: 500, commonTotal: 0 },
      { userId: "b", personalTotal: 200, commonTotal: 0 },
    ]);

    expect(result.commonTotal).toBe(0);
    expect(result.commonShare).toBe(0);
    expect(result.perMember.map((m) => m.transferBeforeContribution)).toEqual([500, 200]);
  });

  it("handles one member with zero personal spending", () => {
    const result = computeSettlementShares([
      { userId: "a", personalTotal: 0, commonTotal: 1000 },
      { userId: "b", personalTotal: 400, commonTotal: 1000 },
    ]);

    expect(result.commonShare).toBe(1000);
    expect(result.perMember.find((m) => m.userId === "a")!.transferBeforeContribution).toBe(1000);
    expect(result.perMember.find((m) => m.userId === "b")!.transferBeforeContribution).toBe(1400);
  });

  it("handles a member with no transactions at all on the invoice", () => {
    const result = computeSettlementShares([
      { userId: "a", personalTotal: 0, commonTotal: 0 },
      { userId: "b", personalTotal: 900, commonTotal: 600 },
    ]);

    expect(result.commonShare).toBe(300);
    expect(result.perMember.find((m) => m.userId === "a")!.transferBeforeContribution).toBe(300);
  });

  it("splits common spend evenly across more than two members", () => {
    const result = computeSettlementShares([
      { userId: "a", personalTotal: 100, commonTotal: 300 },
      { userId: "b", personalTotal: 100, commonTotal: 300 },
      { userId: "c", personalTotal: 100, commonTotal: 300 },
    ]);

    expect(result.commonShare).toBe(300);
  });
});

describe("remainingToTransfer", () => {
  it("subtracts the contribution from the total responsibility", () => {
    expect(remainingToTransfer(2500, 2000)).toBe(500);
  });

  it("keeps the true sign when contribution exceeds what's owed", () => {
    expect(remainingToTransfer(2500, 3000)).toBe(-500);
  });

  it("returns the full amount when contribution is zero", () => {
    expect(remainingToTransfer(2500, 0)).toBe(2500);
  });
});
