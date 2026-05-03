import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  turbopack: {},
  transpilePackages: [
    "@midnight-ntwrk/midnight-js-contracts",
    "@midnight-ntwrk/midnight-js-types",
    "@midnight-ntwrk/compact-runtime",
    "@midnight-ntwrk/ledger-v8",
    "@midnight-ntwrk/midnight-js-fetch-zk-config-provider",
    "@midnight-ntwrk/midnight-js-http-client-proof-provider",
    "@midnight-ntwrk/midnight-js-level-private-state-provider",
    "@midnight-ntwrk/midnight-js-network-id",
    "@midnight-ntwrk/midnight-js-node-zk-config-provider",
    "@midnight-ntwrk/midnight-js-utils",
    "@midnight-ntwrk/wallet-sdk-address-format",
    "@midnight-ntwrk/wallet-sdk-dust-wallet",
    "@midnight-ntwrk/wallet-sdk-facade",
    "@midnight-ntwrk/wallet-sdk-hd",
    "@midnight-ntwrk/wallet-sdk-shielded",
    "@midnight-ntwrk/wallet-sdk-unshielded-wallet",
  ],
  outputFileTracingRoot: process.cwd() + "/..",
  webpack: (config, { isServer }) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };

    config.resolve.alias = {
      ...config.resolve.alias,
      "isomorphic-ws": require.resolve("isomorphic-ws/node.js"),
    };

    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
        crypto: false,
        stream: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        net: false,
        tls: false,
      };
    }

    return config;
  },
};

export default nextConfig;
