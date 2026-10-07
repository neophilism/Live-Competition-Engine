import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "Live Competition Engine",
  description: "Domain-neutral infrastructure for live competitions."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
