import type { NextConfig } from "next";

const isGithubPages = process.env.GITHUB_PAGES === "true";
const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1] || "Wage-Arrears-Calculator";
const basePath = isGithubPages ? `/${repositoryName}` : "";

const nextConfig: NextConfig = {
  output: isGithubPages ? "export" : undefined,
  basePath,
  assetPrefix: basePath || undefined,
  trailingSlash: isGithubPages,
  images: { unoptimized: isGithubPages },
  typescript: { tsconfigPath: isGithubPages ? "tsconfig.pages.json" : "tsconfig.json" },
};

export default nextConfig;
