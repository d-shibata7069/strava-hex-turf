import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import "./globals.css";

export const metadata: Metadata = {
  title: "Strava陣取り",
  description: "ランニングルートを陣取りゲームに",
  icons: { icon: "/icon.svg" },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();

  return (
    <html lang={locale}>
      <body className="min-h-screen antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
