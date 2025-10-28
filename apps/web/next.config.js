import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: true
  },
  transpilePackages: ["@cvsearch/config"],
  webpack(config) {
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      "@aws-sdk/client-s3": path.join(currentDir, "lib/stubs/aws-sdk-client-s3.ts"),
      "@aws-sdk/lib-storage": path.join(currentDir, "lib/stubs/aws-sdk-lib-storage.ts")
    };

    return config;
  }
};

export default nextConfig;
