//@ts-check

const path = require('path');
const { composePlugins, withNx } = require('@nx/next');

/** Monorepo root (parent of `apps/`). Unifies Turbopack + tracing so Next isn’t split across two `node_modules` trees. */
const workspaceRoot = path.resolve(__dirname, '../..');

/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
  outputFileTracingRoot: workspaceRoot,
  turbopack: {
    root: workspaceRoot,
  },
  transpilePackages: ['@nx-projects/ui-components', '@nx-projects/projects'],
  webpack: (config) => {
    config.resolve.modules = [
      path.join(workspaceRoot, 'node_modules'),
      ...(config.resolve.modules ?? []),
    ];
    return config;
  },
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
