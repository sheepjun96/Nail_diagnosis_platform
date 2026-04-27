/** @type {import('next').NextConfig} */
const configuredBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "/v2";
const basePath =
  configuredBasePath === "/" ? "" : configuredBasePath.replace(/\/$/, "");

const nextConfig = {
  ...(basePath ? { basePath } : {}),
  distDir: ".next-build",
  async rewrites() {
    const apiTarget = (
      process.env.INTERNAL_API_PROXY_TARGET ??
      process.env.INTERNAL_API_BASE_URL ??
      "http://127.0.0.1:8000/api"
    ).replace(/\/$/, "");

    return [
      {
        source: "/api/:path*",
        destination: `${apiTarget}/:path*`,
      },
    ];
  },
};

export default nextConfig;
