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

export default nextConfig;
