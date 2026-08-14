"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PartyPopper, Plus, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { AppUser } from "@/lib/types";

export function AdminUsersPanel({ users }: { users: AppUser[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);

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
        {users.map((u) => (
          <div key={u.id} className="flex items-center gap-2 rounded-lg bg-muted/40 p-2.5 text-sm">
            <UserRound className="size-4 text-muted-foreground" />
            {u.email ?? u.id}
          </div>
        ))}
      </div>
    </div>
  );
}
