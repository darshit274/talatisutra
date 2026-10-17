import type { Metadata } from "next";
import { Geist, Geist_Mono, Cormorant_Garamond, Lora, Noto_Serif_Gujarati } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Loaded at the root so their CSS variables are always available, but only *used*
// where .theme-classical maps --font-sans/--font-heading-family to them (spec §1).
const cormorantGaramond = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
});

const notoSerifGujarati = Noto_Serif_Gujarati({
  variable: "--font-noto-gujarati",
  subsets: ["gujarati", "latin"],
});

export const metadata: Metadata = {
  title: {
    default: "TalatiSutra",
    template: "%s | TalatiSutra",
  },
  description: "Placeholder description — replace with client copy (BUILD-PLAN §14).",
  // Default is noindex (CLAUDE.md rule 9) — (app)/(auth) inherit this unchanged.
  // (marketing) pages override it individually to { index: true, follow: true },
  // the scoped carve-out rule 9 now documents.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${cormorantGaramond.variable} ${lora.variable} ${notoSerifGujarati.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
