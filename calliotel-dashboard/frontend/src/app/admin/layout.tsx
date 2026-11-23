import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Calliotel Admin",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-zinc-100 antialiased">
      {children}
    </div>
  );
}