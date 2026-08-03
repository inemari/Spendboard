import { NavMenu } from "@/components/nav-menu";
import { SignOutButton } from "@/components/sign-out-button";

export function AppHeader({
  year,
  month,
  userEmail,
}: {
  year: number;
  month: number;
  userEmail?: string;
}) {
  return (
    <header className="flex items-center justify-between border-b p-4">
      <div className="flex items-center gap-3">
        <NavMenu year={year} month={month} />
        <div>
          <h1 className="text-xl font-semibold">
            {month}/{year}
          </h1>
          {userEmail && <p className="text-sm text-muted-foreground">Signed in as {userEmail}</p>}
        </div>
      </div>
      <SignOutButton />
    </header>
  );
}
