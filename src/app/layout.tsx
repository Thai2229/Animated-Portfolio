import type { Metadata } from "next";
import "@fontsource/inter/latin-300.css";
import "@fontsource/inter/latin-400.css";
import "@fontsource/jetbrains-mono/latin-400.css";
import "@fontsource/jetbrains-mono/latin-500.css";
import "./globals.css";

const description = "Thai Van Le, software engineer and Math-CS student at UC San Diego. An animated portfolio where every planet is a shipped project.";

export const metadata: Metadata = {
  title: "Thai Van Le",
  description,
  keywords: ["Thai Van Le", "software engineer", "portfolio", "UC San Diego", "three.js"],
  authors: [{ name: "Thai Van Le" }],
  openGraph: { title: "Thai Van Le", description, type: "website" },
  twitter: { card: "summary", title: "Thai Van Le", description },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
