const createNextIntlPlugin = require("next-intl/plugin");

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/icon.svg" }];
  },
};

module.exports = withNextIntl(nextConfig);
