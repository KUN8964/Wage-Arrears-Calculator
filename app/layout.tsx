import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3001";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  const image = `${protocol}://${host}/og.png`;
  return {
    title: "薪保清算台｜欠薪、社保与公积金测算",
    description: "按月核对工资、社保与公积金漏缴情况，自动汇总欠款。",
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: { title: "薪保清算台", description: "欠薪 · 社保 · 公积金 一表算清", images: [image] },
    twitter: { card: "summary_large_image", title: "薪保清算台", description: "欠薪 · 社保 · 公积金 一表算清", images: [image] },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
