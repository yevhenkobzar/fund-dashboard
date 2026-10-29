export function slugify(title: string) {
  const base = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "note";
}

export function plainExcerpt(content: string) {
  return content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_[\]()`]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}
