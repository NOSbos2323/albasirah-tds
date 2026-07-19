import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Allow the sandbox preview proxy origin to hit the dev server cleanly.
  allowedDevOrigins: ["*.space-z.ai", "*.z.ai"],
  async rewrites() {
    return [
      // good.js (obfuscated, untouched) still fetches /server/input.php?ids=...
      // Map the legacy PHP endpoint to the new Next.js route handler so existing
      // pages that embed good.js keep working without any change.
      {
        source: "/server/input.php",
        destination: "/api/input",
      },
    ];
  },
};

export default nextConfig;
