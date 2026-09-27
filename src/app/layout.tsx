import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Care Practice Studio — Engagement Platform",
  description: "Internal engagement management platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans">{children}</body>
    </html>
  );
}
