import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NanoMeter — margin intelligence for the agentic economy",
  description: "Real-time per-call P&L, cohort analytics, and counterfactual gas comparisons for Circle Nanopayments."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
