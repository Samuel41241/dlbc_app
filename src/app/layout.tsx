import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DLBC Attendance Intelligence System",
  description:
    "Deeper Life Bible Church – Attendance Intelligence System. Track attendance, manage members, and generate insights.",
  keywords: [
    "Deeper Life Bible Church",
    "Attendance",
    "Church Management",
    "DLBC",
    "Xuzentra",
  ],
  authors: [{ name: "Xuzentra Technologies Limited" }],
  icons: {
    icon: "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgxQP5QFGDt71jtRoYFCnj5rmTELYafcAieMQC4lCW4f61iVMZLk7r8HBBoRWWsBnzr57_Jlw8XBQRUQjWhMqT9LXRk4jPFQePuD78hzSptly72_Y1AqJ929EcLYp-3Ao2M8UQXNocsDJU/w1200-h630-p-k-no-nu/kisspng-deeper-life-bible-church-jacksonville-florida-de-prevailing-power-through-the-ministry-of-the-word-5babe32c1e8418.357141171537991468125.jpg",
  },
  openGraph: {
    title: "DLBC Attendance Intelligence System",
    description: "Deeper Life Bible Church – Attendance Intelligence System",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#14532d",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
