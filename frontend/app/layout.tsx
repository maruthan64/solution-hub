import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@ant-design/v5-patch-for-react-19";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CloudSolution Hub",
  description: "AI Solution Documentation Portal",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
