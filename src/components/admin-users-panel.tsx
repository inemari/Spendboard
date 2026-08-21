"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PartyPopper, Plus, RefreshCw, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { AppUser } from "@/lib/types";

export function AdminUsersPanel({ users }: { users: AppUser[] }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [syncingUserId, setSyncingUserId] = useState<string | null>(null);

  async function handleCreate() {
    setCreating(true);
    try {
      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? "Failed to create user.");
        return;
      }
      toast.success(`Created ${data.email}.`, { icon: <PartyPopper className="size-4" /> });
      setEmail("");
      setPassword("");
      router.refresh();
    } catch {
      toast.error("Failed to create user. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  async function handleSyncUser(user: AppUser) {
    setSyncingUserId(user.id);
    const { data, error } = await supabase.rpc("admin_sync_user_defaults", {
      target_user_id: user.id,
    });
    setSyncingUserId(null);

    if (error) {
      toast.error(`Failed to update ${user.email ?? "the user"}. No partial changes were saved.`);
      return;
    }

    const result = (data ?? {}) as {
      categories_added?: number;
      rules_synced?: number;
    };
    const categoryCount = result.categories_added ?? 0;
    const ruleCount = result.rules_synced ?? 0;
    toast.success(
      `Updated ${user.email ?? "user"}: added ${categoryCount} missing categor${categoryCount === 1 ? "y" : "ies"} and synced ${ruleCount} admin rule${ruleCount === 1 ? "" : "s"}.`,
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <div>
        <h2 className="flex items-center gap-2 font-heading text-2xl font-bold">
          <UserRound className="size-6 text-primary" />
          Users
        </h2>
        <p className="text-sm text-muted-foreground">
          Every account, and a way to create a new one without going through the Supabase
          dashboard.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create a new user</CardTitle>
          <CardDescription>
            Creates the account with the given password, already confirmed — they can sign in
            right away.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button disabled={creating || !email.trim() || !password} onClick={() => void handleCreate()}>
            <Plus className="size-4" />
            Create
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-1.5">
        <h3 className="text-sm font-semibold">All users</h3>
        <p className="text-sm text-muted-foreground">
          Update all adds missing default categories and refreshes every managed admin rule,
          without removing personal categories or rules.
        </p>
        {users.map((u) => (
          <div
            key={u.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/40 p-2.5 text-sm"
          >
            <span className="flex min-w-0 items-center gap-2">
              <UserRound className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{u.email ?? u.id}</span>
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={syncingUserId !== null}
              onClick={() => void handleSyncUser(u)}
            >
              <RefreshCw className={syncingUserId === u.id ? "size-3.5 animate-spin" : "size-3.5"} />
              {syncingUserId === u.id ? "Updating..." : "Update all"}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
