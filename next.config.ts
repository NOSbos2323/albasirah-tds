import type { NextConfig } from "next";

// -----------------------------------------------------------------------
// Reproduces vercel.json from the original repo EXACTLY (paths + headers),
// adapted only where PHP cannot run on Vercel:
//   /server/input.php  ->  /api/input   (the new Next.js TDS route handler)
// Everything else is a 1:1 copy of the original 4 rewrites + 3 header blocks.
// -----------------------------------------------------------------------

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: { ignoreBuildErrors: true },
  reactStrictMode: false,
  allowedDevOrigins: ["*.space-z.ai", "*.z.ai"],

  // --- 4 rewrites (verbatim from original vercel.json, except #2 destination) ---
  async rewrites() {
    return [
      // #1 (exact): /server/good.js -> /server_dir/good.js
      { source: "/server/good.js", destination: "/server_dir/good.js" },
      // #2 (destination changed: PHP can't run on Vercel -> Next.js TDS route)
      { source: "/server/input.php", destination: "/api/input" },
      // #3 (exact): OJS pdfJsViewer path -> cover PDF
      {
        source: "/plugins/generic/pdfJsViewer/pdf.js/web/viewer.html",
        destination: "/pdfviewer/api.pdf",
      },
      // #4 (exact): catch-all cover -> every other path returns the PDF
      { source: "/(.*)", destination: "/pdfviewer/api.pdf" },
    ];
  },

  // --- 3 header blocks (verbatim from original vercel.json) ---
  // The catch-all `/(.*)` block forces Content-Type: application/pdf. If it
  // applied to /server/good.js and /server/input.php it would corrupt them
  // (good.js must stay application/javascript; input.php returns HTML for
  // crawlers and JSON for humans). So the catch-all header source is scoped to
  // exclude the /server and /api prefixes — the only deviation, required for
  // the TDS to actually function on Vercel. Every header VALUE is unchanged.
  async headers() {
    return [
      // block #1 (exact): CORS for the client script
      {
        source: "/server/good.js",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, OPTIONS" },
          {
            key: "Access-Control-Allow-Headers",
            value: "Origin, X-Requested-With, Content-Type, Accept",
          },
        ],
      },
      // block #2 (exact): CORS for the TDS endpoint
      {
        source: "/server/input.php",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, OPTIONS" },
          {
            key: "Access-Control-Allow-Headers",
            value:
              "Origin, X-Requested-With, Content-Type, Accept, Authorization, Range",
          },
          {
            key: "Access-Control-Expose-Headers",
            value: "Accept-Ranges, Content-Length, Content-Range",
          },
        ],
      },
      // block #3 (values exact; source scoped to exclude /server and /api so
      // the TDS responses keep their real content-type)
      {
        source: "/((?!server|api|_next).*)",
        headers: [
          { key: "Content-Type", value: "application/pdf" },
          { key: "Content-Disposition", value: "inline" },
          { key: "Access-Control-Allow-Origin", value: "*" },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, OPTIONS, HEAD",
          },
          {
            key: "Access-Control-Allow-Headers",
            value:
              "Origin, X-Requested-With, Content-Type, Accept, Authorization, Range",
          },
          {
            key: "Access-Control-Expose-Headers",
            value:
              "Accept-Ranges, Content-Length, Content-Range, Content-Disposition, Content-Type",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
