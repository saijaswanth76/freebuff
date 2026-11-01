import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The dev server proxies /api and /uploads to the Express backend so the
// browser talks to a single origin (this keeps httpOnly cookies simple).
// Set VITE_API_BASE_URL to call the API directly on another origin instead.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'https://food-donation-34al.onrender.com', changeOrigin: true, secure: false },
      '/uploads': { target: 'https://food-donation-34al.onrender.com', changeOrigin: true, secure: false },
    },
  },
});
