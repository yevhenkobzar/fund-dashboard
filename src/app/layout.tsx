import type { Metadata } from "next";
import { Fraunces, Outfit } from "next/font/google";
import { fundName } from "@/lib/fund";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces" });

export async function generateMetadata(): Promise<Metadata> {
  const name = fundName();
  return {
    title: { default: name, template: `%s · ${name}` },
    description: "Private partnership desk for the book, weekly reviews, and research.",
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${outfit.variable} ${fraunces.variable} antialiased`}>{children}</body>
    </html>
  );
}
