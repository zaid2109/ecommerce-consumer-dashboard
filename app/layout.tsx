import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { validateRequiredServerEnv } from "@/lib/server/env";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
});

validateRequiredServerEnv()

export const metadata: Metadata = {
  title: "EcoDash - E-commerce Dashboard",
  description: "Analytics dashboard for e-commerce data",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
