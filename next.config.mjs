/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  serverExternalPackages: ['pdf-parse', 'mongodb-memory-server'],
};

export default nextConfig;
