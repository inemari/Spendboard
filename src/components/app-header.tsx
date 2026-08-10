import { NavMenu } from "@/components/nav-menu";
import { MonthNav } from "@/components/month-nav";
import { UserMenu } from "@/components/user-menu";

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
    <header className="sticky top-0 z-30  border-b bg-background/50 backdrop-blur-sm">
      <div className="flex items-center justify-between px-4 py-2.5 gap-3">
        <div className="flex items-center gap-2">
          <NavMenu year={year} month={month} />
          <MonthNav year={year} month={month} />
        </div>

        <div className="flex items-center gap-3">
          {actions}
          {userEmail && <UserMenu userEmail={userEmail} />}
        </div>
      </div>
    </header>
  );
}
