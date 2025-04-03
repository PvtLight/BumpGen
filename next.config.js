/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "betterfans.app",
        port: "",
        pathname: "/**",
      },
    ],
    unoptimized: true, // This will bypass the Next.js Image Optimization API
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
  },
};

module.exports = nextConfig;
