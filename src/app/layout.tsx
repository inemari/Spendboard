import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const description =
  "Spendboard turns a monthly bank statement into a categorized, at-a-glance view of where your money went. Upload an Excel or CSV export, sort transactions by drag-and-drop board, dropdown, or one-by-one review, and tag each as Common, Personal, or Need review to track shared vs. personal spending side by side.";

export const metadata: Metadata = {
  title: "Spendboard",
  description,
  openGraph: {
    title: "Spendboard",
    description,
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Spendboard",
    description,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${dmSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster position="bottom-center" />
      </body>
    </html>
  );
}
