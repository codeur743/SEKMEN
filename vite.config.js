import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// Base path for GitHub Pages.
// If your repo is named "SEKMEN", leave this as "/SEKMEN/".
// If you use a custom domain or deploy elsewhere, set to "/".
export default defineConfig({
  base: './',
  server: {
    port: 5173,
    open: true,
    host: true,
    allowedHosts: true,
  },
  optimizeDeps: {
    exclude: ['web-ifc'],
  },
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/web-ifc/web-ifc.wasm',
          dest: '.',
        },
        {
          src: 'node_modules/web-ifc/web-ifc-mt.wasm',
          dest: '.',
        },
      ],
    }),
  ],
});
