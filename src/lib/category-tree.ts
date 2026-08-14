import type { Category } from "@/lib/types";

type TreeItem = { id: string; parent_id: string | null; sort_order: number; name: string };

export type CategoryGroup<T extends TreeItem = Category> = {
  parent: T;
  children: T[];
};

function bySortOrder<T extends TreeItem>(a: T, b: T): number {
  return a.sort_order - b.sort_order || a.name.localeCompare(b.name);
}

/** Groups categories into top-level parents with their subcategories, both
 * ordered by sort_order. Generic so both `Category` (per-user) and
 * `DefaultCategory` (the admin-managed seed list) can share the same
 * one-level-deep tree logic. */
export function buildCategoryTree<T extends TreeItem>(categories: T[]): CategoryGroup<T>[] {
  const topLevel = categories.filter((c) => !c.parent_id).sort(bySortOrder);

  const childrenByParent = new Map<string, T[]>();
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
export function flattenWithDepth<T extends TreeItem>(
  categories: T[],
): Array<{ category: T; depth: number }> {
  const flat: Array<{ category: T; depth: number }> = [];
  for (const { parent, children } of buildCategoryTree(categories)) {
    flat.push({ category: parent, depth: 0 });
    for (const child of children) flat.push({ category: child, depth: 1 });
  }
  return flat;
}
