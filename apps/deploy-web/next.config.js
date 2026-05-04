require("@akashnetwork/env-loader");
const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true"
});
const { version } = require("./package.json");
const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");

const transpilePackages = ["geist", "@akashnetwork/ui"];

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  reactStrictMode: false,
  productionBrowserSourceMaps: true,
  env: {
    NEXT_PUBLIC_APP_VERSION: version
  },
  compiler: {
    styledComponents: true
  },
  images: {
    domains: ["raw.githubusercontent.com", "avatars.githubusercontent.com"]
  },
  output: "standalone",
  typescript: {
    tsconfigPath: "./tsconfig.build.json",
    ignoreBuildErrors: true
  },
  eslint: {
    ignoreDuringBuilds: true
  },
  transpilePackages,
  i18n: {
    locales: ["en-US"],
    defaultLocale: "en-US"
  },
  onDemandEntries: {
    maxInactiveAge: 60 * 60 * 1000,
    pagesBufferLength: 10
  },
  experimental: {
    optimizePackageImports: [
      "@interchain-ui/react",
      "@nivo/core",
      "@nivo/line",
      "@nivo/pie",
      "@nivo/tooltip",
      "@radix-ui/react-icons",
      "chain-registry",
      "iconoir-react",
      "react-icons",
      "tss-react"
    ]
  },
  webpack: (config, options) => {
    config.externals.push({
      "node:crypto": "crypto"
    });
    config.externals.push("pino-pretty");

    config.resolve.alias = {
      ...config.resolve.alias,
      "prettier/standalone": false,
      "prettier/plugins/yaml": false,
      prettier: false
    };

    if (!options.isServer) {
      config.plugins.push(
        new CopyPlugin({
          patterns: [
            {
              from: path.join(require.resolve("@akashnetwork/chain-sdk"), "..", "..", "sdl-schema.yaml"),
              to: "../public/sdl-schema.yaml"
            }
          ]
        })
      );
    }

    if (process.env.ANALYZE === "true") {
      config.optimization.moduleIds = "named";
      config.optimization.chunkIds = "named";
    }

    return config;
  },
  redirects: async () => {
    return [
      {
        source: "/deploy",
        destination: "/cloud-deploy",
        permanent: true
      }
    ];
  }
};

module.exports = withBundleAnalyzer(nextConfig);
