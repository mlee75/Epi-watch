import { withSentryConfig } from '@sentry/nextjs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: false },
  images: { remotePatterns: [] },

  // Only headers with no breakage risk for this app are set here. A full CSP
  // is deliberately not included: the globe pulls textures from unpkg and
  // GeoJSON from github.io, and the video page frames youtube-nocookie, so a
  // policy needs its own verification pass rather than being asserted blind.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // The dashboard is never meant to be framed; this is the clickjacking
          // control. It does not affect the YouTube iframes the page embeds,
          // which are about what we frame, not who frames us.
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
          },
        ],
      },
    ];
  },

  webpack: (config, { webpack }) => {
    config.resolve.fallback = { fs: false, net: false, tls: false };

    // Pin 'three' to a single resolved path so that three/examples/jsm/* files
    // which bare-import 'three' always resolve to the same module copy.
    config.resolve.alias = {
      ...config.resolve.alias,
      three: path.resolve(__dirname, 'node_modules/three'),
    };

    const stubPath = path.resolve(__dirname, 'lib/stubs/three-webgpu.js');

    // Use NormalModuleReplacementPlugin to intercept three/webgpu and three/tsl
    // requests before resolution — this catches them even from nested node_modules
    // (globe.gl/node_modules/three-render-objects, three-globe, etc.)
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(/^three\/webgpu$/, stubPath),
      new webpack.NormalModuleReplacementPlugin(/^three\/tsl$/, stubPath),
    );

    return config;
  },
};

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "none-izw",

  project: "javascript-nextjs",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
