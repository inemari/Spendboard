"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Menu,
  MousePointerClick,
  PiggyBank,
  Receipt,
  Shield,
  Tags,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { isAdminEmail } from "@/lib/is-admin";
import { SignOutButton } from "./sign-out-button";

// Static: no screen but the overview has a timeframe, and the overview's own
// timeframe lives in query params, so none of these need a date to link to.
const links = [
  { href: "/", label: "Overview", Icon: LayoutDashboard },
  { href: "/categorize", label: "Categorize", Icon: MousePointerClick },
  { href: "/categories", label: "Manage categories", Icon: Tags },
  { href: "/rules", label: "Rules", Icon: Wand2 },
  { href: "/settlement", label: "Settlement", Icon: Receipt },
];

const adminLinks = [
  { href: "/admin/users", label: "Admin: Users", Icon: Shield },
  { href: "/admin/households", label: "Admin: Households", Icon: Shield },
  { href: "/admin/rules", label: "Admin: Rule templates", Icon: Shield },
  { href: "/admin/categories", label: "Admin: Default categories", Icon: Shield },
];

export function NavMenu({ userEmail }: { userEmail?: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const showAdminLinks = isAdminEmail(userEmail);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="ghost" size="icon" />}>
        <Menu className="size-5" />
      </SheetTrigger>{" "}
      <p className="hidden self-center text-md text-foreground sm:flex items-center ">
        <PiggyBank className="size-6 text-primary pe-1" />
        <span className="font-bold text-game">Spend</span>Board
      </p>
      <SheetContent side="left">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <PiggyBank className="size-5 text-primary" />
            <p className="hidden self-center text-xl text-foreground sm:block">
              <span className="font-bold">Spend</span>Board
            </p>
          </SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-1 px-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-muted",
                pathname === link.href
                  ? "bg-muted text-primary"
                  : "text-foreground",
              )}
            >
              <link.Icon className="size-4" />
              {link.label}
            </Link>
          ))}
        </nav>

        {showAdminLinks && (
          <nav className="mt-2 flex flex-col gap-1 border-t px-2 pt-2">
            {adminLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-muted",
                  pathname === link.href ? "bg-muted text-primary" : "text-foreground",
                )}
              >
                <link.Icon className="size-4" />
                {link.label}
              </Link>
            ))}
          </nav>
        )}

        <SignOutButton />
      </SheetContent>
    </Sheet>
  );
}
