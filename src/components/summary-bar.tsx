import { Card } from "@/components/ui/card";
import { formatAmount } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TxType } from "@/lib/types";

export function SummaryBar({
  common,
  personal,
  needReview,
  overall,
  uncategorizedCount,
  needReviewCount,
  onSelectType,
}: {
  common: number;
  personal: number;
  needReview: number;
  overall: number;
  uncategorizedCount: number;
  needReviewCount: number;
  onSelectType: (type: TxType) => void;
}) {
  const items: { label: string; value: number; type: TxType | null }[] = [
    { label: "Overall", value: overall, type: null },
    { label: "Common", value: common, type: "common" },
    { label: "Personal", value: personal, type: "personal" },
    { label: "Need review", value: needReview, type: "need_review" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((item) => (
        <Card
          key={item.label}
          onClick={item.type ? () => onSelectType(item.type!) : undefined}
          onKeyDown={
            item.type
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectType(item.type!);
                  }
                }
              : undefined
          }
          className={cn(
            "p-4 text-left",
            item.type && "cursor-pointer hover:ring-2 hover:ring-primary",
          )}
          {...(item.type ? { role: "button", tabIndex: 0 } : {})}
        >
          <p className="text-sm text-muted-foreground">{item.label}</p>
          <p className="text-lg font-semibold tabular-nums">{formatAmount(item.value)}</p>
        </Card>
      ))}
      <Card className="p-4">
        <p className="text-sm text-muted-foreground">Uncategorized</p>
        <p className="text-lg font-semibold tabular-nums">
          {uncategorizedCount}
          {needReviewCount > 0 && (
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              · {needReviewCount} need review
            </span>
          )}
        </p>
      </Card>
    </div>
  );
}
