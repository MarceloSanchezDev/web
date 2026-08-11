import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: env.VITE_API_TARGET || 'http://127.0.0.1:3000',
          changeOrigin: true,
          // El backend restringe CORS. Las llamadas pasan por el servidor de
          // Vite, por lo que se usa un origen local permitido por la API.
          headers: { origin: 'http://localhost:3000' },
          rewrite: path => path.replace(/^\/api/, '')
        }
      }
    }
  };
});
