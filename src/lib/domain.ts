export const ROLES = ["ADMIN", "EDITOR", "VIEWER"] as const;
export type Role = (typeof ROLES)[number];

export const TX_TYPES = ["BUY", "SELL", "DEPOSIT", "WITHDRAWAL", "FEE", "YIELD"] as const;
export type TxType = (typeof TX_TYPES)[number];

export const ASSET_CLASSES = ["CRYPTO", "STOCK", "THEMATIC_BASKET", "DEFI_YIELD"] as const;
export type AssetClass = (typeof ASSET_CLASSES)[number];

export const SLEEVES = ["CRYPTO", "STOCKS", "THEMATIC", "DEFI_YIELD", "ARBITRAGE"] as const;
export type Sleeve = (typeof SLEEVES)[number];

export const ARTICLE_TYPES = ["MARKET_REVIEW", "RESEARCH"] as const;
export type ArticleKind = (typeof ARTICLE_TYPES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Admin",
  EDITOR: "Editor",
  VIEWER: "Viewer",
};

export const TX_LABEL: Record<TxType, string> = {
  BUY: "Buy",
  SELL: "Sell",
  DEPOSIT: "Deposit",
  WITHDRAWAL: "Withdrawal",
  FEE: "Fee",
  YIELD: "Yield",
};

export const ASSET_LABEL: Record<AssetClass, string> = {
  CRYPTO: "Crypto",
  STOCK: "Stocks",
  THEMATIC_BASKET: "Thematic baskets",
  DEFI_YIELD: "DeFi yield",
};

export const SLEEVE_LABEL: Record<Sleeve, string> = {
  CRYPTO: "Crypto",
  STOCKS: "Stocks",
  THEMATIC: "Thematic baskets",
  DEFI_YIELD: "DeFi yield",
  ARBITRAGE: "Arbitrage",
};

export const SLEEVE_COLOR: Record<Sleeve | "CASH", string> = {
  CRYPTO: "#1f4b5a",
  STOCKS: "#8a5a32",
  THEMATIC: "#3e5c45",
  DEFI_YIELD: "#5c4d78",
  ARBITRAGE: "#a15c38",
  CASH: "#c4b49a",
};

export const ASSET_COLOR: Record<AssetClass | "CASH", string> = {
  CRYPTO: "#1f4b5a",
  STOCK: "#8a5a32",
  THEMATIC_BASKET: "#3e5c45",
  DEFI_YIELD: "#5c4d78",
  CASH: "#c4b49a",
};

export const SECTIONS = {
  MARKET_REVIEW: {
    type: "MARKET_REVIEW" as const,
    href: "/reviews",
    nav: "Market review",
    kicker: "Weekly market review",
    title: "Weekly market review",
    description:
      "A running note on what the desk is seeing. Editors draft in markdown and publish when the note is ready. Viewers see published reviews only.",
    apiType: "market_review",
    empty: "No published market reviews yet.",
  },
  RESEARCH: {
    type: "RESEARCH" as const,
    href: "/research",
    nav: "Research",
    kicker: "Weekly research articles",
    title: "Weekly research articles",
    description:
      "Research on market opportunities, separate from the weekly review. Same draft and publish flow. Viewers see published articles only.",
    apiType: "research",
    empty: "No published research articles yet.",
  },
} as const;

export function sectionForApiType(value: string) {
  if (value === "market_review") return SECTIONS.MARKET_REVIEW;
  if (value === "research") return SECTIONS.RESEARCH;
  return null;
}

const ASSET_ALIASES: Record<string, AssetClass> = {
  crypto: "CRYPTO",
  stock: "STOCK",
  stocks: "STOCK",
  equity: "STOCK",
  equities: "STOCK",
  thematic: "THEMATIC_BASKET",
  thematic_basket: "THEMATIC_BASKET",
  "thematic basket": "THEMATIC_BASKET",
  defi: "DEFI_YIELD",
  defi_yield: "DEFI_YIELD",
  "defi yield": "DEFI_YIELD",
};

const SLEEVE_ALIASES: Record<string, Sleeve> = {
  crypto: "CRYPTO",
  stocks: "STOCKS",
  stock: "STOCKS",
  thematic: "THEMATIC",
  thematic_basket: "THEMATIC",
  defi: "DEFI_YIELD",
  defi_yield: "DEFI_YIELD",
  arbitrage: "ARBITRAGE",
  arb: "ARBITRAGE",
};

const TX_ALIASES: Record<string, TxType> = {
  buy: "BUY",
  sell: "SELL",
  deposit: "DEPOSIT",
  withdrawal: "WITHDRAWAL",
  withdraw: "WITHDRAWAL",
  fee: "FEE",
  yield: "YIELD",
};

export function parseAssetClass(value: string): AssetClass | null {
  return ASSET_ALIASES[value.trim().toLowerCase()] ?? null;
}

export function parseSleeve(value: string): Sleeve | null {
  return SLEEVE_ALIASES[value.trim().toLowerCase()] ?? null;
}

export function parseTxType(value: string): TxType | null {
  return TX_ALIASES[value.trim().toLowerCase()] ?? null;
}

export function parseRole(value: string): Role | null {
  const upper = value.trim().toUpperCase();
  if (upper === "ADMIN" || upper === "EDITOR" || upper === "VIEWER") return upper;
  return null;
}
