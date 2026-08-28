import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const title = "RealInsight | A Daly Ventures applied-AI demonstration";
const description = "See how bounded AI, deterministic rules, and human confirmation turn messy listing evidence into a reviewable decision brief.";
const fallbackOrigin = new URL("https://realinsight-openai.brendandaly.chatgpt.site");

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const forwardedProtocol = requestHeaders.get("x-forwarded-proto");
  const safeHost = host && /^[a-z0-9.-]+(?::\d+)?$/i.test(host) ? host : null;
  const protocol = forwardedProtocol === "http" || safeHost?.startsWith("localhost:") ? "http" : "https";
  const origin = safeHost ? new URL(`${protocol}://${safeHost}`) : fallbackOrigin;
  const socialImage = new URL("/social-preview.jpg", origin).toString();

  return {
    metadataBase: origin,
    title,
    description,
    openGraph: {
      title,
      description,
      url: origin,
      siteName: "Daly Ventures AI Lab",
      type: "website",
      images: [{ url: socialImage, width: 1200, height: 630, alt: "RealInsight — a Daly Ventures applied-AI decision workflow." }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [socialImage],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
