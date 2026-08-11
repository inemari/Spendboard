import { NavMenu } from "@/components/nav-menu";
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
        {/* Month stepping lives on the overview's own timeframe switcher, not
            here — the header shouldn't carry a second, competing month control. */}
        <NavMenu year={year} month={month} />

        <div className="flex items-center gap-3">
          {actions}
          {userEmail && <UserMenu userEmail={userEmail} />}
        </div>
      </div>
    </header>
  );
}
