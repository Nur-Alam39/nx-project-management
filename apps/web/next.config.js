//@ts-check

const { composePlugins, withNx } = require('@nx/next');

/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
  transpilePackages: ['@nx-projects/ui-components', '@nx-projects/projects'],
  async rewrites() {
    const target =
      process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:3333';
    return [
      {
        source: '/api/backend/:path*',
        destination: `${target.replace(/\/$/, '')}/:path*`,
      },
    ];
  },
  // Use this to set Nx-specific options
  // See: https://nx.dev/recipes/next/next-config-setup
  nx: {},
};

const plugins = [
  // Add more Next.js plugins to this list if needed.
  withNx,
];

module.exports = composePlugins(...plugins)(nextConfig);
