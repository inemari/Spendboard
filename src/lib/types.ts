export type TxType = "common" | "personal";

export type Category = {
  id: string;
  name: string;
  color: string | null;
  is_default: boolean;
  parent_id: string | null;
};

export type Transaction = {
  id: string;
  month_id: string;
  date: string;
  description: string;
  amount: number;
  category_id: string | null;
  type: TxType;
};
