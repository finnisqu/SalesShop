import { execFileSync } from 'node:child_process';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Resolve provenance when Vite starts/builds, then embed it in the bundle.
// A loaded tab reports its own build, not the moving HEAD of a GitHub branch.
function git(...args: string[]): string {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, '.', 'VITE_');
  // Cloudflare Workers Builds (unlike Pages) supplies WORKERS_CI_* values.
  const workersBranch = process.env.WORKERS_CI_BRANCH?.trim() || '';
  const branch =
    workersBranch ||
    process.env.CF_PAGES_BRANCH?.trim() ||
    process.env.GITHUB_HEAD_REF?.trim() ||
    process.env.GITHUB_REF_NAME?.trim() ||
    git('branch', '--show-current');
  const candidateSha =
    process.env.WORKERS_CI_COMMIT_SHA?.trim() ||
    process.env.CF_PAGES_COMMIT_SHA?.trim() ||
    process.env.GITHUB_SHA?.trim() ||
    git('rev-parse', 'HEAD');
  // Never invent a commit ID or claim a remote branch has already deployed.
  const commit = /^[0-9a-f]{40,64}$/i.test(candidateSha) ? candidateSha : '';
  const channel = command === 'serve' || (branch && branch !== 'main')
    ? 'DEV'
    : branch === 'main'
      ? 'MAIN'
      : 'BUILD';
  return {
    base: env.VITE_BASE_PATH?.trim() || '/',
    plugins: [react()],
    define: {
      __SALESSHOP_BUILD__: JSON.stringify({ channel, branch, commit }),
    },
    server: {
      port: 5173,
      open: true,
    },
  };
});
