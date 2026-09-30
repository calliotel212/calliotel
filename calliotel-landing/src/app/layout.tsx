import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Calliotel",
  description:
    "Arabic + English AI receptionists that answer 24/7, book appointments, and never sleep.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">{children}</body>
    </html>
  );
}
