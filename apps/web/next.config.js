/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@receptionai/config",
    "@receptionai/validation",
    "@receptionai/security",
    "@receptionai/ui",
  ],
  async rewrites() {
    const apiUrl = process.env.API_URL || "http://127.0.0.1:4000";
    return [
      {
        source: "/api/v1/:path*",
        destination: `${apiUrl}/api/v1/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
