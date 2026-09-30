/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "www.syyhoaxanalyzer.com" },
      { protocol: "https", hostname: "turnbackhoax.id" },
    ],
  },
};

export default nextConfig;
