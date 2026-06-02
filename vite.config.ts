import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const GITHUB_PAGES_BASE = '/aureus_-eco-dominion/';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const isGitHubPages = env.VITE_DEPLOY_TARGET === 'github-pages';

  return {
    base: isGitHubPages ? GITHUB_PAGES_BASE : '/',
    server: {
      port: 3005,
      host: '0.0.0.0',
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
