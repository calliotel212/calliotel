import type { Metadata, Viewport } from "next";
import { Fraunces, Outfit } from "next/font/google";
import { CookieBanner } from "@/components/cookie-banner";
import { Providers } from "@/components/providers";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
});

const sans = Outfit({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.AUTH_URL?.trim() || "http://localhost:3000"),
  title: {
    default: "dramame",
    template: "%s · dramame",
  },
  description:
    "Vertical short-story series. Each episode is 1:00–1:30. A story is 60–75 episodes. Finish one, then scroll up into the next.",
  applicationName: "dramame",
};

export const viewport: Viewport = {
  themeColor: "#090B18",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body>
        <Providers>
          {children}
          <CookieBanner />
        </Providers>
      </body>
    </html>
  );
}
