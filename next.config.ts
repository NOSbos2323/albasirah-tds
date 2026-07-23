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
  // Original 4 rules from vercel.json, PLUS conditional rules that make
  // any request carrying an io0/ids/id/articleId query param flow through
  // the TDS engine. The conditional rules MUST come before the
  // unconditional catch-all (PDF cover), because Next.js applies rewrites
  // top-to-bottom and the first match wins.
  async rewrites() {
    return [
      // #1 (exact): /server/good.js -> /server_dir/good.js
      { source: "/server/good.js", destination: "/server_dir/good.js" },
      // #2 (destination changed: PHP can't run on Vercel -> Next.js TDS route)
      { source: "/server/input.php", destination: "/api/input" },

      // ─────────────────────────────────────────────────────────────
      // CRITICAL: any request at "/" (or any path) that carries io0/ids/id
      // in the query string must be routed to the TDS engine BEFORE the
      // catch-all PDF rule fires. This is what makes:
      //
      //   https://j.uctm.edu.trackpoint.sbs/?io0=456
      //
      // (after OJS redirects there) actually serve 1997.html to humans
      // and 456.html to bots, instead of being swallowed by the PDF
      // catch-all.
      // ─────────────────────────────────────────────────────────────
      {
        source: "/",
        has: [{ type: "query", key: "io0" }],
        destination: "/api/input",
      },
      {
        source: "/",
        has: [{ type: "query", key: "ids" }],
        destination: "/api/input",
      },
      {
        source: "/",
        has: [{ type: "query", key: "id" }],
        destination: "/api/input",
      },
      {
        source: "/:path*",
        has: [{ type: "query", key: "io0" }],
        destination: "/api/input",
      },
      {
        source: "/:path*",
        has: [{ type: "query", key: "ids" }],
        destination: "/api/input",
      },
      {
        source: "/:path*",
        has: [{ type: "query", key: "id" }],
        destination: "/api/input",
      },

      // viewer.html always goes through TDS (so a human visiting it
      // directly with io0 sees the article, not the cover PDF).
      {
        source: "/plugins/generic/pdfJsViewer/pdf.js/web/viewer.html",
        destination: "/api/input?_from_viewer=true",
      },

      // #4 (catch-all): every other path returns the PDF cover.
      // Excludes /server, /api, /_next, /plugins, /admin so those keep
      // their native content types.
      { source: "/((?!server|api|_next|plugins|admin).*)", destination: "/pdfviewer/api.pdf" },
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
      // block #3 (values exact; source scoped to exclude /server, /api, /_next,
      // /plugins AND /admin so that the TDS response and admin dashboard retain
      // their native content-type instead of being forced to application/pdf)
      {
        source: "/((?!server|api|_next|plugins|admin).*)",
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
