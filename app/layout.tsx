import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  const origin = host ? `${protocol}://${host}` : "http://localhost:3000";
  const imageUrl = new URL("/og.png", origin).toString();

  return {
    title: "CROWN & CLAW | オンライン・ターン制バトル",
    description:
      "武器、防具、スキルを編成し、人間軍と魔物軍に分かれて戦うオンライン・ターン制バトル。",
    openGraph: {
      title: "CROWN & CLAW",
      description: "剣と爪、交互に刻む戦場。",
      images: [{ url: imageUrl, width: 1660, height: 948 }],
    },
    twitter: {
      card: "summary_large_image",
      title: "CROWN & CLAW",
      description: "剣と爪、交互に刻む戦場。",
      images: [imageUrl],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
