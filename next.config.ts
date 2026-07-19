import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Allow the sandbox preview proxy origin to hit the dev server cleanly.
  allowedDevOrigins: ["*.space-z.ai", "*.z.ai"],

  // --------------------------------------------------------------------
  // Rewrites — reproduce the 4 rules from the original vercel.json:
  //   /server/good.js                                   -> good.js (static)
  //   /server/input.php                                 -> /api/input
  //   /plugins/generic/pdfJsViewer/.../viewer.html      -> /pdfviewer/api.pdf
  //   /(.*)(catch-all cover)                            -> /pdfviewer/api.pdf
  // The catch-all is the "cover" that makes unknown paths return a PDF so the
  // domain looks like a PDF-viewer service. We exclude the managed prefixes
  // (api, server, pdfviewer, plugins, _next) and the root "/" so the dashboard,
  // the TDS endpoint, good.js and the OJS plugin path keep working.
  // --------------------------------------------------------------------
  async rewrites() {
    return [
      {
        source: "/server/input.php",
        destination: "/api/input",
      },
      {
        source: "/plugins/generic/pdfJsViewer/pdf.js/web/viewer.html",
        destination: "/pdfviewer/api.pdf",
      },
      {
        // ".+" (not ".*") so the root "/" is NOT covered -> dashboard renders.
        // Negative lookahead skips every managed prefix.
        source: "/((?!api|server|pdfviewer|plugins|_next).+)",
        destination: "/pdfviewer/api.pdf",
      },
    ];
  },

  // --------------------------------------------------------------------
  // Headers — reproduce the 3 header blocks from the original vercel.json.
  // NOTE: we deliberately do NOT reproduce the catch-all `/(.*)` header block
  // that forced `Content-Type: application/pdf` on every response, because that
  // would corrupt the article HTML (served to crawlers) and the JSON (served to
  // humans). The PDF content-type is instead applied only to the real PDF path.
  // --------------------------------------------------------------------
  async headers() {
    const corsGoodJs = [
      { key: "Access-Control-Allow-Origin", value: "*" },
      { key: "Access-Control-Allow-Methods", value: "GET, OPTIONS" },
      { key: "Access-Control-Allow-Headers", value: "Origin, X-Requested-With, Content-Type, Accept" },
    ];
    const corsInput = [
      { key: "Access-Control-Allow-Origin", value: "*" },
      { key: "Access-Control-Allow-Methods", value: "GET, POST, OPTIONS" },
      { key: "Access-Control-Allow-Headers", value: "Origin, X-Requested-With, Content-Type, Accept, Authorization, Range" },
      { key: "Access-Control-Expose-Headers", value: "Accept-Ranges, Content-Length, Content-Range" },
    ];
    const corsPdf = [
      { key: "Content-Type", value: "application/pdf" },
      { key: "Content-Disposition", value: "inline" },
      { key: "Access-Control-Allow-Origin", value: "*" },
      { key: "Access-Control-Allow-Methods", value: "GET, POST, OPTIONS, HEAD" },
      { key: "Access-Control-Allow-Headers", value: "Origin, X-Requested-With, Content-Type, Accept, Authorization, Range" },
      { key: "Access-Control-Expose-Headers", value: "Accept-Ranges, Content-Length, Content-Range, Content-Disposition, Content-Type" },
    ];
    return [
      { source: "/server/good.js", headers: corsGoodJs },
      { source: "/api/input", headers: corsInput },
      { source: "/server/input.php", headers: corsInput },
      { source: "/pdfviewer/api.pdf", headers: corsPdf },
    ];
  },
};

export default nextConfig;
