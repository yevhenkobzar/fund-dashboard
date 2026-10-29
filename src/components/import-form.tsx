"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ImportPlan } from "@/lib/csv/transactions";
import { commitImport, previewImport } from "@/server/mutations";
import { Button } from "@/components/ui/button";

export function ImportForm() {
  const router = useRouter();
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [csv, setCsv] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function inspect(file: File) {
    const text = await file.text();
    setCsv(text);
    setPending(true);
    setError(null);
    const next = await previewImport(text);
    setPlan(next);
    setPending(false);
  }

  async function commit() {
    setPending(true);
    setError(null);
    const result = await commitImport(csv);
    if (!result.ok) {
      setError(result.error);
      setPending(false);
      return;
    }
    router.push(`/transactions?imported=${result.created}`);
  }

  const blocked = !plan || Boolean(plan.fileError) || Boolean(plan.bookError) || plan.readyCount === 0;

  return (
    <div className="space-y-4">
      <label className="block rounded-lg border border-dashed border-brass/50 bg-card p-6 text-sm">
        <span className="font-medium">Choose a CSV file</span>
        <p className="mt-1 text-muted-foreground">The file is checked before anything is written.</p>
        <input
          className="mt-4 block w-full text-sm"
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void inspect(file);
          }}
        />
      </label>
      {pending ? <p className="text-sm text-muted-foreground">Checking the file…</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {plan?.fileError ? <p className="text-sm text-danger">{plan.fileError}</p> : null}
      {plan && !plan.fileError ? (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="book-table">
            <thead>
              <tr><th>Line</th><th>Row</th><th>Status</th><th>Detail</th></tr>
            </thead>
            <tbody>
              {plan.rows.map((row) => (
                <tr key={row.line}>
                  <td className="tabular-nums">{row.line}</td>
                  <td>{row.summary}</td>
                  <td className="capitalize">{row.status}</td>
                  <td>{row.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {plan?.bookError ? <p className="text-sm text-danger">{plan.bookError}</p> : null}
      {plan && !plan.fileError ? (
        <Button type="button" disabled={pending || blocked} onClick={() => void commit()}>
          Import {plan.readyCount} {plan.readyCount === 1 ? "transaction" : "transactions"}
        </Button>
      ) : null}
    </div>
  );
}
