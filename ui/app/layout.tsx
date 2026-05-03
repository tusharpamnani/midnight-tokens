import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "Midnight Token Launchpad",
  description: "Deploy and manage custom fungible tokens on Midnight (factory + token).",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark scroll-smooth">
      <body className="font-sans bg-zinc-950 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
