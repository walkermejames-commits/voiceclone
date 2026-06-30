import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "ChipVoice Studio",
  description: "A desktop-first audiobook workshop for writers.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
