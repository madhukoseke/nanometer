/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // ESLint on `next build` is slow; run `npx next lint` in CI or before push.
  eslint: { ignoreDuringBuilds: true }
};
module.exports = nextConfig;
