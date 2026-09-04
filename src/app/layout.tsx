import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// Telemetry readings, hardware IDs and PIN codes are read character by
// character in the console; a monospace face makes transcription reliable.
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  weight: ["400", "500"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#050d0a",
};

export const metadata: Metadata = {
  title: {
    default: "Eco-Data Link",
    template: "%s · Eco-Data Link",
  },
  description:
    "Biodiversity digital twins, live bioacoustic telemetry and TNFD-aligned reporting for luxury eco-resorts.",
  // The production core is an operational tool, not a marketing surface.
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${mono.variable} font-sans`}>
        {children}
      </body>
    </html>
  );
}
