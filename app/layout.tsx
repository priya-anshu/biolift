import type { Metadata, Viewport } from "next";
import { Orbitron, Poppins, Urbanist } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import PwaRegister from "@/components/PwaRegister";

const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

const urbanist = Urbanist({
  variable: "--font-urbanist",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Biolift - Smart fitness Companion",
  description: "AI Powered Fitness Companion for Personalized Workouts and Nutrition",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      {
        url: "/logo/logoLight.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/logo/logoDark.png",
        media: "(prefers-color-scheme: dark)",
      },
    ],
    apple: [{ url: "/logo/logoLight.png" }],
    shortcut: ["/logo/logoLight.png"],
  },
  appleWebApp: {
    capable: true,
    title: "BioLift",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#007BFF" },
    { media: "(prefers-color-scheme: dark)", color: "#FF2C2C" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning={true}>
      <body
        className={`${orbitron.variable} ${poppins.variable} ${urbanist.variable} antialiased`}
      >
        <Providers>{children}</Providers>
        <PwaRegister />
      </body>
    </html>
  );
}
