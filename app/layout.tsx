import type { Metadata } from "next";
import { Orbitron, Poppins, Urbanist } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

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
      </body>
    </html>
  );
}
