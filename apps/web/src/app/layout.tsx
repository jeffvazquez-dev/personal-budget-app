import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Personal Budget App",
  description: "Clean personal budgeting for Jeff & Alina",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
