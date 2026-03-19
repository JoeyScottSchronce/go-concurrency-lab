import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * GitHub Pages project sites live at https://owner.github.io/repo/ — Vite `base` must match.
 * User/org site repo (owner.github.io) uses base `/`. Override anytime with VITE_BASE_PATH.
 */
function resolveBase(): string {
  const explicit = process.env.VITE_BASE_PATH?.trim();
  if (explicit) {
    if (explicit === '/' || explicit === '') return '/';
    const withSlash = explicit.startsWith('/') ? explicit : `/${explicit}`;
    return withSlash.endsWith('/') ? withSlash : `${withSlash}/`;
  }

  const full = process.env.GITHUB_REPOSITORY ?? '';
  const [, repo] = full.split('/');
  if (!repo) return '/';

  const owner = full.split('/')[0] ?? '';
  if (repo === `${owner}.github.io`) return '/';

  return `/${repo}/`;
}

export default defineConfig({
  base: resolveBase(),
  plugins: [react(), tailwindcss()],
});
