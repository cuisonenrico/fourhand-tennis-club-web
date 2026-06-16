import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Fourhand Tennis Club — Book a court in three taps",
    template: "%s · Fourhand Tennis Club",
  },
  description:
    "A visually rich, fast booking experience. Pick a court, pick a time, confirm — and get an instant confirmation. Classes and competitions too.",
  openGraph: {
    title: "Fourhand Tennis Club",
    description: "Book a court in three taps.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
