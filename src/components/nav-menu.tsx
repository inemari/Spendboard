"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Menu,
  MousePointerClick,
  PiggyBank,
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
import { SignOutButton } from "./sign-out-button";

export function NavMenu({ year, month }: { year: number; month: number }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const base = `/${year}/${month}`;

  const links = [
    { href: base, label: "Overview", Icon: LayoutDashboard },
    {
      href: `${base}/categorize`,
      label: "Categorize",
      Icon: MousePointerClick,
    },
    { href: `${base}/categories`, label: "Manage categories", Icon: Tags },
    { href: `${base}/rules`, label: "Rules", Icon: Wand2 },
  ];

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
        <SignOutButton />
      </SheetContent>
    </Sheet>
  );
}
