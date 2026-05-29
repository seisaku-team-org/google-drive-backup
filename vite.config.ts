import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages のサブパス配信用。リポジトリ名に合わせて変更すること。
// 例: https://<user>.github.io/google-drive-backup/ → base: '/google-drive-backup/'
const REPO_BASE = process.env.VITE_BASE_PATH ?? '/';

export default defineConfig({
  plugins: [react()],
  base: REPO_BASE,
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  server: {
    port: 5173,
  },
});
