"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  ChartLine,
  FileUp,
  FlaskConical,
  KeyRound,
  LayoutDashboard,
  Layers,
  LogOut,
  Menu,
  Newspaper,
  ScrollText,
  Tag,
  Unplug,
  Users,
} from "lucide-react";
import type { Role } from "@/lib/domain";
import { ROLE_LABEL } from "@/lib/domain";
import { authorize } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";

type Item = { href: string; label: string; icon: ComponentType<{ className?: string }>; action?: "import_csv" | "view_audit" | "manage_team" | "manage_tokens" };

const ITEMS: Item[] = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/holdings", label: "Holdings", icon: Layers },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/import", label: "CSV import", icon: FileUp, action: "import_csv" },
  { href: "/prices", label: "Prices", icon: Tag },
  { href: "/performance", label: "Performance", icon: ChartLine },
  { href: "/integrations", label: "Integrations", icon: Unplug },
  { href: "/reviews", label: "Market review", icon: Newspaper },
  { href: "/research", label: "Research", icon: FlaskConical },
  { href: "/audit", label: "Audit trail", icon: ScrollText, action: "view_audit" },
  { href: "/team", label: "Team", icon: Users, action: "manage_team" },
  { href: "/tokens", label: "API tokens", icon: KeyRound, action: "manage_tokens" },
];

function NavLinks({
  role,
  showTeam,
  onNavigate,
}: {
  role: Role;
  showTeam: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const visible = ITEMS.filter((item) => {
    if (item.action === "manage_team" && !showTeam) return false;
    return !item.action || authorize(role, item.action);
  });
  return (
    <nav className="flex flex-col gap-1">
      {visible.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-[#d9d2c6] hover:bg-white/5",
              active && "bg-white/10 text-white",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function Shell({
  fund,
  user,
  showTeam,
  logout,
  children,
}: {
  fund: string;
  user: { email: string; name: string | null; role: Role };
  showTeam: boolean;
  logout: () => Promise<void>;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen bg-paper md:grid md:grid-cols-[248px_1fr]">
      <aside className="hidden min-h-screen flex-col bg-ink px-4 py-6 text-[#e7e1d6] md:flex">
        <div className="px-3 pb-6">
          <p className="text-[11px] uppercase tracking-[0.18em] text-[#c4b49a]">Partnership desk</p>
          <p className="mt-1 font-serif text-2xl leading-tight text-white">{fund}</p>
        </div>
        <NavLinks role={user.role} showTeam={showTeam} />
        <div className="mt-auto px-3 pt-6">
          <p className="truncate text-sm text-white">{user.name || user.email}</p>
          <p className="truncate text-xs text-[#b7b0a4]">{user.email}</p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-[#c4b49a]">{ROLE_LABEL[user.role]}</p>
          <form action={logout} className="mt-4">
            <button className="inline-flex items-center gap-2 text-sm text-[#d9d2c6] hover:text-white" type="submit">
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="flex items-center justify-between border-b border-border bg-ink px-4 py-3 text-white md:hidden">
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-[#c4b49a]">Partnership desk</p>
            <p className="font-serif text-lg leading-tight">{fund}</p>
          </div>
          <button type="button" aria-label="Open menu" onClick={() => setOpen(true)} className="rounded-md p-2 hover:bg-white/10">
            <Menu className="h-5 w-5" />
          </button>
        </header>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="bg-ink text-[#e7e1d6]">
            <DialogTitle className="font-serif text-2xl text-white">{fund}</DialogTitle>
            <div className="mt-4">
              <NavLinks role={user.role} showTeam={showTeam} onNavigate={() => setOpen(false)} />
            </div>
            <form action={logout} className="mt-6">
              <button className="text-sm text-[#d9d2c6]" type="submit">Sign out</button>
            </form>
          </DialogContent>
        </Dialog>
        <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
