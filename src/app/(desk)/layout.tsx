import { signOut } from "@/auth";
import { fundName } from "@/lib/fund";
import { Shell } from "@/components/shell";
import { requireUser } from "@/server/guard";

export const dynamic = "force-dynamic";

export default async function DeskLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }
  return (
    <Shell fund={fundName()} user={{ email: user.email, name: user.name, role: user.role }} logout={logout}>
      {children}
    </Shell>
  );
}
