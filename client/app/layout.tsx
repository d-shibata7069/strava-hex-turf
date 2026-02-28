import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Strava陣取り",
  description: "ランニングルートを陣取りゲームに",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased">{children}</body>
    </html>
  );
}
