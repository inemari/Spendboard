import { Card } from "@/components/ui/card";
import { formatAmount } from "@/lib/format";

export function SummaryBar({
  common,
  personal,
  overall,
  uncategorizedCount,
}: {
  common: number;
  personal: number;
  overall: number;
  uncategorizedCount: number;
}) {
  const items = [
    { label: "Overall", value: overall },
    { label: "Common", value: common },
    { label: "Personal", value: personal },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label} className="p-4">
          <p className="text-sm text-muted-foreground">{item.label}</p>
          <p className="text-lg font-semibold tabular-nums">{formatAmount(item.value)}</p>
        </Card>
      ))}
      <Card className="p-4">
        <p className="text-sm text-muted-foreground">Needs review</p>
        <p className="text-lg font-semibold tabular-nums">{uncategorizedCount}</p>
      </Card>
    </div>
  );
}
