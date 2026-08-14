"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Link2, PartyPopper, UserX, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { AppUser } from "@/lib/types";

type HouseholdGroup = {
  householdId: string;
  members: { user_id: string; email: string | null }[];
};

export function AdminHouseholdsPanel({
  households,
  unpairedUsers,
}: {
  households: HouseholdGroup[];
  unpairedUsers: AppUser[];
}) {
  const router = useRouter();
  const [userA, setUserA] = useState<string>();
  const [userB, setUserB] = useState<string>();
  const [pairing, setPairing] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<{ user_id: string; email: string | null } | null>(
    null,
  );
  const [removing, setRemoving] = useState(false);

  async function handlePair() {
    if (!userA || !userB) return;
    setPairing(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("admin_create_household", {
      user_a: userA,
      user_b: userB,
    });
    setPairing(false);

    if (error) {
      toast.error(error.message ?? "Failed to create household.");
      return;
    }
    toast.success("Household created!", { icon: <PartyPopper className="size-4" /> });
    setUserA(undefined);
    setUserB(undefined);
    router.refresh();
  }

  async function confirmRemove() {
    const pending = pendingRemove;
    setPendingRemove(null);
    if (!pending) return;

    setRemoving(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("admin_remove_household_member", {
      p_user_id: pending.user_id,
    });
    setRemoving(false);

    if (error) {
      toast.error(error.message ?? "Failed to remove member.");
      return;
    }
    toast.success(`Removed ${pending.email ?? "member"} from the household.`);
    router.refresh();
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <div>
        <h2 className="flex items-center gap-2 font-heading text-2xl font-bold">
          <Users className="size-6 text-primary" />
          Households
        </h2>
        <p className="text-sm text-muted-foreground">
          Pair two users into a household so they can settle shared credit-card bills. Neither
          user can see the other's individual transactions — only shared totals.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pair two users</CardTitle>
          <CardDescription>Only users not already in a household are listed.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <UserSelect placeholder="First user" value={userA} onChange={setUserA} users={unpairedUsers} exclude={userB} />
          <Link2 className="size-4 text-muted-foreground" />
          <UserSelect placeholder="Second user" value={userB} onChange={setUserB} users={unpairedUsers} exclude={userA} />
          <Button disabled={!userA || !userB || pairing} onClick={() => void handlePair()}>
            Create household
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">Existing households</h3>
        {households.length === 0 ? (
          <p className="text-sm text-muted-foreground">No households yet.</p>
        ) : (
          households.map((h) => (
            <div key={h.householdId} className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Users className="size-4 text-muted-foreground" />
                {h.members.map((m) => (
                  <span
                    key={m.user_id}
                    className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1"
                  >
                    {m.email ?? m.user_id}
                    <button
                      type="button"
                      aria-label={`Remove ${m.email ?? m.user_id}`}
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setPendingRemove(m)}
                    >
                      <UserX className="size-3.5" />
                    </button>
                  </span>
                ))}
              </div>
              {h.members.length < 2 && (
                <AddPartnerRow householdId={h.householdId} unpairedUsers={unpairedUsers} />
              )}
            </div>
          ))
        )}
      </div>

      <AlertDialog open={pendingRemove !== null} onOpenChange={(open) => !open && setPendingRemove(null)}>
        {pendingRemove && (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Remove {pendingRemove.email ?? "this member"} from this household?
              </AlertDialogTitle>
              <AlertDialogDescription>
                The household itself (and its invoices/settlements) stays intact — this only
                breaks the pairing. They can be re-paired later.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" disabled={removing} onClick={() => void confirmRemove()}>
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>
    </div>
  );
}

function AddPartnerRow({
  householdId,
  unpairedUsers,
}: {
  householdId: string;
  unpairedUsers: AppUser[];
}) {
  const router = useRouter();
  const [userId, setUserId] = useState<string>();
  const [adding, setAdding] = useState(false);

  async function handleAdd() {
    if (!userId) return;
    setAdding(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("admin_add_household_member", {
      p_household_id: householdId,
      p_user_id: userId,
    });
    setAdding(false);

    if (error) {
      toast.error(error.message ?? "Failed to add partner.");
      return;
    }
    toast.success("Partner added.");
    setUserId(undefined);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <UserSelect placeholder="Add a partner…" value={userId} onChange={setUserId} users={unpairedUsers} exclude={undefined} />
      <Button size="sm" variant="outline" disabled={!userId || adding} onClick={() => void handleAdd()}>
        Add
      </Button>
    </div>
  );
}

function UserSelect({
  placeholder,
  value,
  onChange,
  users,
  exclude,
}: {
  placeholder: string;
  value: string | undefined;
  onChange: (value: string) => void;
  users: AppUser[];
  exclude: string | undefined;
}) {
  return (
    <Select value={value} onValueChange={(v) => v && onChange(v)}>
      <SelectTrigger className="w-56">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {users
          .filter((u) => u.id !== exclude)
          .map((u) => (
            <SelectItem key={u.id} value={u.id}>
              {u.email ?? u.id}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  );
}
