import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InvoicePicker } from "@/components/upload-button";
import type { CreditInvoice } from "@/lib/types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const invoices: CreditInvoice[] = [
  {
    id: "9dd7bc27-0e2d-45b5-a061-a7dfa0928646",
    household_id: "household-1",
    label: "September 2026",
    created_at: "2026-09-01T00:00:00Z",
  },
];

describe("InvoicePicker", () => {
  it("shows an existing invoice label instead of its UUID", () => {
    render(
      <InvoicePicker
        value={invoices[0].id}
        invoices={invoices}
        onValueChange={vi.fn()}
      />,
    );

    const trigger = screen.getByRole("combobox", { name: "Invoice: September 2026" });
    expect(trigger.textContent).toContain("September 2026");
    expect(trigger.textContent).not.toContain(invoices[0].id);
  });

  it("labels the new-invoice choice", () => {
    render(
      <InvoicePicker value="__new__" invoices={invoices} onValueChange={vi.fn()} />,
    );

    const trigger = screen.getByRole("combobox", { name: "Invoice: New invoice…" });
    expect(trigger.textContent).toContain("New invoice…");
  });
});
