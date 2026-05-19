import type { Metadata } from "next";
import { Roboto, Roboto_Flex } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-sans",
});

const robotoFlex = Roboto_Flex({
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "Adaptive Explainer",
  description:
    "AI-powered learning that adapts to what you know — personalized 5-step lessons on any topic.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn(roboto.variable, robotoFlex.variable)}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
