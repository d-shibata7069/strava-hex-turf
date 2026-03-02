const createNextIntlPlugin = require("next-intl/plugin");

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["h3-js"],
    // タイルAPIのサーバーレス関数トレースから h3-js の不要部分を除外しデプロイサイズを削減（Deploying outputs 失敗対策）
    outputFileTracingExcludes: {
      "/api/tiles": [
        "./node_modules/h3-js/dist/browser/**",
        "./node_modules/h3-js/**/*.map",
        "./node_modules/h3-js/benchmark/**",
      ],
      "/api/groups/[id]/tiles": [
        "./node_modules/h3-js/dist/browser/**",
        "./node_modules/h3-js/**/*.map",
        "./node_modules/h3-js/benchmark/**",
      ],
    },
  },
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/icon.svg" }];
  },
};

module.exports = withNextIntl(nextConfig);
