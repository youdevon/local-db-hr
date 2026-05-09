import type { Metadata } from "next";
import { Geist_Mono, Inter, Manrope } from "next/font/google";

import { Providers } from "@/components/providers";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Local DB HR",
    template: "%s · Local DB HR",
  },
  description: "Internal HR administration for Local DB HR",
  icons: {
    icon: "/favicon.ico",
    apple: "/favicon.ico",
  },
  openGraph: {
    images: ["/favicon.ico"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${manrope.variable} ${geistMono.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="bg-background text-foreground min-h-full font-body antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
