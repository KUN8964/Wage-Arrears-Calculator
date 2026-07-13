import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3001";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  const image = `${protocol}://${host}/og.png`;
  return {
    title: "薪保计算器｜欠薪、双倍工资与社保公积金测算",
    description: "免登录、开箱即用的工资、社保与公积金欠款计算器，数据仅保存在本机。",
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: { title: "薪保计算器", description: "欠薪 · 双倍工资 · 社保 · 公积金 一表算清", images: [image] },
    twitter: { card: "summary_large_image", title: "薪保计算器", description: "免登录，打开即可测算", images: [image] },
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
