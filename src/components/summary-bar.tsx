import { Card } from "@/components/ui/card";
import { formatAmount } from "@/lib/format";

export function SummaryBar({
  common,
  personal,
  needReview,
  overall,
  uncategorizedCount,
  needReviewCount,
}: {
  common: number;
  personal: number;
  needReview: number;
  overall: number;
  uncategorizedCount: number;
  needReviewCount: number;
}) {
  const items = [
    { label: "Overall", value: overall },
    { label: "Common", value: common },
    { label: "Personal", value: personal },
    { label: "Need review", value: needReview },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((item) => (
        <Card key={item.label} className="p-4">
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
