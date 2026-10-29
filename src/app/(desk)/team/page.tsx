import { ROLE_LABEL, ROLES } from "@/lib/domain";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { Flash, PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changeRole, inviteMember, revokeAccess } from "@/server/mutations";
import { requireAction } from "@/server/guard";

export const metadata = { title: "Team" };

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; invited?: string; updated?: string; revoked?: string }>;
}) {
  const actor = await requireAction("manage_team");
  const query = await searchParams;
  const people = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });
  const success = query.invited ? "Invite saved. They can request a sign-in link." : query.updated ? "Role updated." : query.revoked ? "Access revoked." : undefined;
  return (
    <div>
      <PageHeader
        kicker="Admin"
        title="Team"
        description="Only invited emails can sign in. New invites default to viewer. You can invite someone directly as an editor."
      />
      <Flash error={query.error} success={success} />
      <form action={inviteMember} className="mb-8 grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-[1fr_1fr_160px_auto] md:items-end">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required placeholder="editor@firm.com" />
        </div>
        <div>
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" placeholder="Optional" />
        </div>
        <div>
          <Label htmlFor="role">Role</Label>
          <select id="role" name="role" defaultValue="VIEWER" className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm">
            {ROLES.map((role) => <option key={role} value={role}>{ROLE_LABEL[role]}</option>)}
          </select>
        </div>
        <Button type="submit">Invite</Button>
      </form>
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="book-table min-w-[720px]">
          <thead><tr><th>Person</th><th>Role</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {people.map((person) => (
              <tr key={person.id}>
                <td>
                  <div className="font-medium">{person.name || person.email}</div>
                  <div className="text-xs text-muted-foreground">{person.email}{person.isExample ? " · Example" : ""} · added {formatDate(person.createdAt)}</div>
                </td>
                <td>
                  {person.disabledAt ? (
                    <Badge>Revoked</Badge>
                  ) : (
                    <form action={changeRole} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={person.id} />
                      <select name="role" defaultValue={person.role} className="h-9 rounded-md border border-input bg-card px-2 text-sm" aria-label={`Role for ${person.email}`}>
                        {ROLES.map((role) => <option key={role} value={role}>{ROLE_LABEL[role]}</option>)}
                      </select>
                      <Button type="submit" size="sm" variant="secondary">Save</Button>
                    </form>
                  )}
                </td>
                <td>{person.disabledAt ? "Revoked" : person.id === actor.id ? "You" : "Active"}</td>
                <td>
                  {!person.disabledAt && person.id !== actor.id ? (
                    <form action={revokeAccess}>
                      <input type="hidden" name="id" value={person.id} />
                      <button type="submit" className="text-sm text-danger">Revoke</button>
                    </form>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
