import type { Metadata } from "next";
import "./globals.css";
import "./glass-theme.css";

export function generateMetadata(): Metadata {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://xinbao-qingsuantai.kunkun8964.chatgpt.site").replace(/\/$/, "");
  const basePath = process.env.GITHUB_PAGES === "true" ? `/${process.env.GITHUB_REPOSITORY?.split("/")[1] || "Wage-Arrears-Calculator"}` : "";
  const image = `${siteUrl}/og.png`;
  return {
    title: "薪保计算器｜欠薪、双倍工资与社保公积金测算",
    description: "免登录、开箱即用的工资、社保与公积金欠款计算器，数据仅保存在本机。",
    icons: { icon: `${basePath}/favicon.svg`, shortcut: `${basePath}/favicon.svg` },
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
