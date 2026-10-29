import type { Role } from "@/lib/domain";

export type Action =
  | "view_book"
  | "edit_book"
  | "import_csv"
  | "update_price"
  | "record_snapshot"
  | "write_article"
  | "publish_article"
  | "read_draft"
  | "read_published"
  | "view_audit"
  | "manage_team"
  | "manage_tokens";

const EDITOR_ACTIONS: Action[] = [
  "view_book",
  "edit_book",
  "import_csv",
  "update_price",
  "record_snapshot",
  "write_article",
  "publish_article",
  "read_draft",
  "read_published",
  "view_audit",
];

export function authorize(role: Role | null, action: Action): boolean {
  if (!role) return false;
  if (role === "ADMIN") return true;
  if (role === "EDITOR") return EDITOR_ACTIONS.includes(action);
  return action === "view_book" || action === "read_published";
}

export type DirectoryEntry = {
  email: string;
  disabled: boolean;
};

export function inviteDecision(
  email: string,
  directory: DirectoryEntry[],
): { allowed: true } | { allowed: false; reason: "not_invited" | "disabled" | "invalid" } {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return { allowed: false, reason: "invalid" };
  }
  const row = directory.find((entry) => entry.email.toLowerCase() === normalized);
  if (!row) return { allowed: false, reason: "not_invited" };
  if (row.disabled) return { allowed: false, reason: "disabled" };
  return { allowed: true };
}

export function roleChangeAllowed(input: {
  targetId: string;
  actorId: string;
  targetIsAdmin: boolean;
  nextIsAdmin: boolean;
  adminCount: number;
  disabling: boolean;
}): string | null {
  if (input.disabling && input.targetId === input.actorId) {
    return "You cannot revoke your own access.";
  }
  const removesAdmin = input.targetIsAdmin && (input.disabling || !input.nextIsAdmin);
  if (removesAdmin && input.adminCount <= 1) {
    return "The desk needs at least one admin.";
  }
  return null;
}

export function canReadArticle(role: Role, status: "DRAFT" | "PUBLISHED"): boolean {
  if (status === "PUBLISHED") return authorize(role, "read_published");
  return authorize(role, "read_draft");
}
