import { DndContext } from "@dnd-kit/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CategorySidebar } from "@/components/category-sidebar";
import { TransactionList } from "@/components/transaction-list";
import { buildCategoryColorMap } from "@/lib/category-colors";
import type { Category, Transaction } from "@/lib/types";

const categories: Category[] = [
  {
    id: "food",
    name: "Food",
    is_default: false,
    parent_id: null,
    sort_order: 0,
    icon: null,
  },
  {
    id: "groceries",
    name: "Groceries",
    is_default: false,
    parent_id: "food",
    sort_order: 0,
    icon: null,
  },
  {
    id: "travel",
    name: "Travel",
    is_default: false,
    parent_id: null,
    sort_order: 1,
    icon: null,
  },
];

const transaction: Transaction = {
  id: "transaction-1",
  month_id: "month-1",
  date: "2026-09-29",
  description: "Grocery store",
  location: "Oslo",
  notes: null,
  amount: -250,
  category_id: null,
  type: "personal",
  card_type: "debit",
  credit_invoice_id: null,
};

describe("overview transaction interactions", () => {
  it("shows every category as a target, including empty categories and subcategories", () => {
    render(
      <DndContext>
        <CategorySidebar
          categories={categories}
          transactions={[transaction]}
          totalCount={1}
          uncategorizedCount={1}
          uncategorizedSpent={250}
          colorMap={buildCategoryColorMap(categories)}
          filter={{ kind: "all" }}
          onSelectFilter={vi.fn()}
        />
      </DndContext>,
    );

    expect(screen.getByRole("button", { name: /Food/ })).toBeDefined();
    expect(screen.getByRole("button", { name: /Travel/ })).toBeDefined();
    expect(screen.getByRole("button", { name: /Uncategorized/ })).toBeDefined();

    fireEvent.change(screen.getByLabelText("Find a category"), {
      target: { value: "Groceries" },
    });
    expect(screen.getByRole("button", { name: /Groceries/ })).toBeDefined();
  });

  it("keeps category and transaction details available without expanding", () => {
    render(
      <DndContext>
        <TransactionList
          transactions={[transaction]}
          categories={categories}
          selectedIds={new Set()}
          highlightedIds={new Set()}
          filterChip={null}
          draggable
          onToggleSelect={vi.fn()}
          onCategoryChange={vi.fn()}
          onTypeToggle={vi.fn()}
          onCardTypeToggle={vi.fn()}
          onNotesChange={vi.fn()}
          onDelete={vi.fn()}
        />
      </DndContext>,
    );

    expect(
      screen.getByRole("button", { name: "Drag Grocery store to a category" }),
    ).toBeDefined();
    expect(
      screen.getByRole("combobox", { name: "Change category for Grocery store" }),
    ).toBeDefined();
    expect(screen.getByText("Oslo")).toBeDefined();
    expect(screen.getByText("Personal")).toBeDefined();
    expect(screen.getByText("debit")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Add note to Grocery store" }));
    expect(screen.getByPlaceholderText("Add a note…")).toBeDefined();
  });
});
