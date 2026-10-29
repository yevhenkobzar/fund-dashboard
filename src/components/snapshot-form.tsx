"use client";

import { useState } from "react";
import { createSnapshot } from "@/server/mutations";
import { todayUtcDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SnapshotForm({ currentAum }: { currentAum: string }) {
  const [aum, setAum] = useState("");
  return (
    <form action={createSnapshot} className="grid gap-4 md:grid-cols-2">
      <div>
        <Label htmlFor="asOf">Date</Label>
        <Input id="asOf" name="asOf" type="text" inputMode="numeric" placeholder="YYYY-MM-DD" defaultValue={todayUtcDate()} required />
      </div>
      <div>
        <Label htmlFor="aum">AUM (USD)</Label>
        <Input id="aum" name="aum" inputMode="decimal" value={aum} onChange={(event) => setAum(event.target.value)} required />
        <button type="button" className="mt-2 text-xs text-primary underline" onClick={() => setAum(currentAum)}>
          Use current book value
        </button>
      </div>
      <div>
        <Label htmlFor="shares">Shares outstanding</Label>
        <Input id="shares" name="shares" inputMode="decimal" placeholder="Optional" />
      </div>
      <div>
        <Label htmlFor="note">Note</Label>
        <Input id="note" name="note" placeholder="Optional" />
      </div>
      <div className="md:col-span-2">
        <Button type="submit">Record snapshot</Button>
      </div>
    </form>
  );
}
