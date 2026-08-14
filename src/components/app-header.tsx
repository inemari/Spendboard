import { NavMenu } from "@/components/nav-menu";
import { UserMenu } from "@/components/user-menu";

export function AppHeader({
  userEmail,
  actions,
}: {
  userEmail?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30  border-b bg-background/50 backdrop-blur-sm">
      <div className="flex items-center justify-between px-4 py-2.5 gap-3">
        {/* No month control here: the overview's timeframe switcher owns the
            only timeframe in the app, and the other screens have none. */}
        <NavMenu userEmail={userEmail} />

        <div className="flex items-center gap-3">
          {actions}
          {userEmail && <UserMenu userEmail={userEmail} />}
        </div>
      </div>
    </header>
  );
}
