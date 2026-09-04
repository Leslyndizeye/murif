/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // This app is 100% client-side (auth-gated internal tool) and keeps its
  // existing react-router-dom routing inside a single catch-all page - see
  // src/pages/[[...slug]].tsx. No server rendering happens for any route.
};

module.exports = nextConfig;
