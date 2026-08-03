import type { Category } from "@/lib/types";

export type CategoryGroup = {
  parent: Category;
  children: Category[];
};

function bySortOrder(a: Category, b: Category): number {
  return a.sort_order - b.sort_order || a.name.localeCompare(b.name);
}

/** Groups categories into top-level parents with their subcategories, both ordered by sort_order. */
export function buildCategoryTree(categories: Category[]): CategoryGroup[] {
  const topLevel = categories.filter((c) => !c.parent_id).sort(bySortOrder);

  const childrenByParent = new Map<string, Category[]>();
  for (const c of categories) {
    if (!c.parent_id) continue;
    const siblings = childrenByParent.get(c.parent_id) ?? [];
    siblings.push(c);
    childrenByParent.set(c.parent_id, siblings);
  }
  for (const siblings of childrenByParent.values()) {
    siblings.sort(bySortOrder);
  }

  return topLevel.map((parent) => ({
    parent,
    children: childrenByParent.get(parent.id) ?? [],
  }));
}

/** Flattens the tree back into a list, each item paired with its nesting depth (0 or 1). */
export function flattenWithDepth(categories: Category[]): Array<{ category: Category; depth: number }> {
  const flat: Array<{ category: Category; depth: number }> = [];
  for (const { parent, children } of buildCategoryTree(categories)) {
    flat.push({ category: parent, depth: 0 });
    for (const child of children) flat.push({ category: child, depth: 1 });
  }
  return flat;
}

/** A display label for contexts where hierarchy can't be shown spatially (e.g. a flat column header). */
export function getCategoryLabel(category: Category, categories: Category[]): string {
  if (!category.parent_id) return category.name;
  const parent = categories.find((c) => c.id === category.parent_id);
  return parent ? `${parent.name} · ${category.name}` : category.name;
}
