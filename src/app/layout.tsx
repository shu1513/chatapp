import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "chatapp — paid video calls with creators",
  description:
    "Book a private video call with a creator you follow, or take calls from your fans and get paid for your time.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SiteHeader />
        {children}
        <footer className="mt-auto border-t border-gray-200 py-6 text-center text-xs text-gray-500 dark:border-gray-800">
          <a href="/terms" className="hover:underline">
            Terms
          </a>
          {" · "}
          <a href="/privacy" className="hover:underline">
            Privacy
          </a>
          {" · "}
          <a href="/refunds" className="hover:underline">
            Refunds
          </a>
        </footer>
      </body>
    </html>
  );
}
