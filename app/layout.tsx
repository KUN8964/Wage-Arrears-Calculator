import type { Metadata } from "next";
import "./globals.css";
import "./glass-theme.css";

export function generateMetadata(): Metadata {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://xinbao-qingsuantai.kunkun8964.chatgpt.site").replace(/\/$/, "");
  const basePath = process.env.GITHUB_PAGES === "true" ? `/${process.env.GITHUB_REPOSITORY?.split("/")[1] || "Wage-Arrears-Calculator"}` : "";
  return {
    title: "薪资计算器｜工资、社保、年假与加班权益测算",
    description: "免登录、开箱即用的欠薪、社保、公积金、年假、加班与调休折现计算器，数据仅保存在本机。",
    icons: { icon: `${basePath}/favicon.svg`, shortcut: `${basePath}/favicon.svg` },
    openGraph: { title: "薪资计算器", description: "欠薪 · 社保 · 年假 · 加班 · 调休 一表算清" },
    twitter: { card: "summary", title: "薪资计算器", description: "免登录，打开即可测算" },
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
