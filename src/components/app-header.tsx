import { User } from "lucide-react";
import { NavMenu } from "@/components/nav-menu";

export function AppHeader({
  year,
  month,
  userEmail,
  actions,
}: {
  year: number;
  month: number;
  userEmail?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex items-center justify-between border-b p-4">
      <div className="flex items-center gap-3">
        <NavMenu year={year} month={month} />
        <div>
          <h1 className="text-xl font-semibold">
            {month}/{year}
          </h1>
        </div>
      </div>
      <div className="flex items-center gap-4">
        {actions}
        {userEmail && (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <User className="size-3.5" />
            {userEmail}
          </p>
        )}
      </div>
    </header>
  );
}
