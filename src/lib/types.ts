export type TxType = "common" | "personal" | "need_review";
export type CardType = "regular" | "credit";

export type Category = {
  id: string;
  name: string;
  color: string | null;
  is_default: boolean;
  parent_id: string | null;
  sort_order: number;
};

export type Transaction = {
  id: string;
  month_id: string;
  date: string;
  description: string;
  location: string | null;
  notes: string | null;
  amount: number;
  category_id: string | null;
  type: TxType;
  card_type: CardType;
};
