import type { ComponentProps, ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CategoryColumn } from "@/components/category-column";
import type { Transaction } from "@/lib/types";

vi.mock("@dnd-kit/core", () => ({
  useDroppable: () => ({ setNodeRef: vi.fn(), isOver: false }),
}));

vi.mock("@/components/draggable-transaction-card", () => ({
  DraggableTransactionCard: ({ transaction }: { transaction: Transaction }) => (
    <div>{transaction.description}</div>
  ),
}));

vi.mock("@/components/ui/checkbox", () => ({ Checkbox: () => null }));
vi.mock("@/components/ui/button", () => ({
  Button: ({ children }: { children?: ReactNode }) => <button>{children}</button>,
}));
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children?: ReactNode }) => <>{children}</>,
  DropdownMenuCheckboxItem: ({ children }: { children?: ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children?: ReactNode }) => <>{children}</>,
  DropdownMenuItem: ({ children }: { children?: ReactNode }) => <>{children}</>,
  DropdownMenuSeparator: () => null,
  DropdownMenuTrigger: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

const transaction: Transaction = {
  id: "transaction-1",
  month_id: "month-1",
  date: "2026-09-18",
  description: "Coffee shop",
  location: null,
  notes: null,
  amount: -42,
  category_id: "category-1",
  type: "personal",
  card_type: "debit",
  credit_invoice_id: null,
};

const baseProps: ComponentProps<typeof CategoryColumn> = {
  id: "category-1",
  title: "Food",
  transactions: [],
  subcategories: [],
  swatch: {
    bar: "",
    text: "",
    ring: "",
    soft: "",
    badge: "",
    gradient: "",
    gradientSelected: "",
  },
  categories: [],
  onCategoryChange: vi.fn(),
  onTypeToggle: vi.fn(),
  onCardTypeToggle: vi.fn(),
  onNotesChange: vi.fn(),
  onDelete: vi.fn(),
  selectedIds: new Set(),
  onToggleSelect: vi.fn(),
  onToggleSelectAll: vi.fn(),
  highlightedIds: new Set(),
  expandedId: null,
  onToggleExpanded: vi.fn(),
};

describe("CategoryColumn", () => {
  it("transitions from compact to populated without changing hook order", () => {
    const view = render(<CategoryColumn {...baseProps} compact />);

    view.rerender(
      <CategoryColumn {...baseProps} compact={false} transactions={[transaction]} />,
    );

    expect(screen.getByText("Coffee shop")).toBeDefined();
  });

  it("transitions from populated to compact without changing hook order", () => {
    const view = render(
      <CategoryColumn {...baseProps} compact={false} transactions={[transaction]} />,
    );

    view.rerender(<CategoryColumn {...baseProps} compact transactions={[]} />);

    expect(screen.getByText("Drop here")).toBeDefined();
  });
});
