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

  // --- Rewrites ---
  // Original 4 rules from vercel.json, PLUS one conditional rule that makes
  // /plugins/.../viewer.html?io0=<id> serve TDS content transparently (URL in
  // the browser stays unchanged). The conditional rule MUST come before the
  // unconditional viewer.html -> PDF rule, because Next.js applies rewrites
  // top-to-bottom and the first match wins.
  async rewrites() {
    return [
      // #1 (exact): /server/good.js -> /server_dir/good.js
      { source: "/server/good.js", destination: "/server_dir/good.js" },
      // #2 (destination changed: PHP can't run on Vercel -> Next.js TDS route)
      { source: "/server/input.php", destination: "/api/input" },

      // NEW (conditional): when the OJS viewer.html URL carries an `io0` query
      // param, transparently rewrite it to /api/input so the TDS serves the
      // article HTML directly. The browser URL stays
      // /plugins/.../viewer.html?io0=1997 — no redirect, no URL change.
      {
        source: "/plugins/generic/pdfJsViewer/pdf.js/web/viewer.html",
        has: [{ type: "query", key: "io0" }],
        destination: "/api/input",
      },

      // #3 (exact): OJS pdfJsViewer path WITHOUT io0 -> cover PDF
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
      // NEW: same CORS on the /plugins viewer path so cross-origin fetches of
      // ?io0=... work (matches the input.php CORS policy).
      {
        source: "/plugins/generic/pdfJsViewer/pdf.js/web/viewer.html",
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
      // block #3 (values exact; source scoped to exclude /server, /api, /_next
      // AND /plugins so the TDS response served at
      // /plugins/.../viewer.html?io0=... keeps its real text/html content-type
      // instead of being forced to application/pdf by this catch-all header)
      {
        source: "/((?!server|api|_next|plugins).*)",
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
