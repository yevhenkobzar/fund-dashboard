"use client";

import { useActionState } from "react";
import { createToken, type ActionState } from "@/server/mutations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function TokenForm() {
  const [state, action, pending] = useActionState(createToken, {} as ActionState);
  return (
    <form action={action} className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div>
        <Label htmlFor="name">Token name</Label>
        <Input id="name" name="name" placeholder="Research agent" required />
      </div>
      {state.formError ? <p className="text-sm text-danger">{state.formError}</p> : null}
      <Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create token"}</Button>
      {state.token ? (
        <div className="rounded-md border border-brass/40 bg-[#f8f1e3] p-3 text-sm">
          <p className="font-medium">Copy this token now. It will not be shown again.</p>
          <p className="mt-2 break-all font-mono text-xs">{state.token}</p>
        </div>
      ) : null}
    </form>
  );
}
