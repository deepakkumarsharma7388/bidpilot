/** @type {import('next').NextConfig} */
const nextConfig = {
  // bullmq optionally supports @valkey/valkey-glide as an alternative Redis client,
  // but we only use ioredis. This optional dependency pulls in native platform
  // binaries that don't exist for every OS/arch, which breaks webpack's build.
  // Since we never import it ourselves, safely ignore it during bundling.
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@valkey/valkey-glide': false,
    }
    return config
  },
  serverExternalPackages: ['@valkey/valkey-glide', 'bullmq'],
}
module.exports = nextConfig
