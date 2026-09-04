/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // The resort surfaces and the platform console are two dev servers over one
  // project, and they cannot share a build directory: each would overwrite the
  // other's manifests on every recompile. Production needs no split — two
  // `next start` processes read the same build.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  reactStrictMode: true,
  poweredByHeader: false,
  allowedDevOrigins: ["192.168.1.143", "127.0.0.1", "localhost"],
  eslint: {
    dirs: ["src"],
  },
  experimental: {
    // Telemetry ingestion accepts multipart bodies carrying compressed audio.
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        // Kiosk displays must never cache a stale soundscape or featured species.
        source: "/lobby",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
