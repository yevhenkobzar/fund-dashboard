import { ROLE_LABEL } from "@/lib/domain";
import { requireUser } from "@/server/guard";

export default async function ForbiddenPage() {
  const user = await requireUser();
  return (
    <div className="max-w-lg">
      <p className="text-[11px] uppercase tracking-[0.16em] text-brass">Access</p>
      <h1 className="mt-1 font-serif text-4xl">This role cannot do that</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        You are signed in as {ROLE_LABEL[user.role]}. Editors can update the book and publish both article sections. Only an admin can invite people, change roles, or create API tokens.
      </p>
    </div>
  );
}
