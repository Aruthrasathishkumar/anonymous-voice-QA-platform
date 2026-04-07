/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: '/anonymous-voice-QA-platform',
  assetPrefix: '/anonymous-voice-QA-platform/',
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
};

export default nextConfig;
