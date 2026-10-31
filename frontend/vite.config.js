import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],

    resolve: {
      alias: {
        // Path aliases — use @/ instead of relative ../../
        '@': path.resolve(__dirname, './src'),
        '@components': path.resolve(__dirname, './src/components'),
        '@features': path.resolve(__dirname, './src/features'),
        '@pages': path.resolve(__dirname, './src/pages'),
        '@hooks': path.resolve(__dirname, './src/hooks'),
        '@services': path.resolve(__dirname, './src/services'),
        '@store': path.resolve(__dirname, './src/store'),
        '@utils': path.resolve(__dirname, './src/utils'),
        '@styles': path.resolve(__dirname, './src/styles'),
        '@i18n':   path.resolve(__dirname, './src/i18n'),
      },
    },

    server: {
      port: parseInt(env.VITE_PORT) || 3000,
      host: true, // expose to LAN (0.0.0.0)
      proxy: {
        // Proxy every /api/* request to the Express backend.
        // VITE_API_BASE_URL in .env is '/api' (relative, same-origin).
        // The proxy target must be the backend *origin only* — no path.
        // env.VITE_BACKEND_ORIGIN lets you override the host in .env.local
        // without touching this file (e.g. for a different LAN IP).
        '/api': {
          target: env.VITE_BACKEND_ORIGIN || 'http://localhost:5000',
          changeOrigin: true,
          // No rewrite needed — /api stays /api on the backend
        },
        // Proxy uploaded static files so image URLs work in dev.
        // Images are stored on the backend and served at /uploads/*
        // The Vite dev server does NOT serve them, so they must be proxied.
        '/uploads': {
          target: env.VITE_BACKEND_ORIGIN || 'http://localhost:5000',
          changeOrigin: true,
        },
      },
    },

    preview: {
      port: parseInt(env.VITE_PORT) || 3000,
      host: true,
    },

    build: {
      outDir: 'dist',
      sourcemap: false,
      rollupOptions: {
        output: {
          // Split vendor chunks for better caching
          manualChunks: {
            react:     ['react', 'react-dom'],
            router:    ['react-router-dom'],
            charts:    ['recharts'],
            vendor:    ['axios', 'zustand', 'date-fns'],
          },
        },
      },
    },
  };
});
