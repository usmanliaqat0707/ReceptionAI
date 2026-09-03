/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@receptionai/db"],
  webpack: (config) => {
    return config;
  },
};

module.exports = nextConfig;
