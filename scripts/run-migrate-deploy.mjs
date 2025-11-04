#!/usr/bin/env node
import { spawn } from 'node:child_process';

function ensureSslMode(url, label) {
  if (!url) {
    return url;
  }
  if (/sslmode=/i.test(url)) {
    return url;
  }
  const separator = url.includes('?') ? '&' : '?';
  const normalized = `${url}${separator}sslmode=require`;
  console.warn(`\n[run-migrate-deploy] '${label}' に sslmode=require を自動付与しました。`);
  return normalized;
}

const env = { ...process.env };
env.DATABASE_URL = ensureSslMode(env.DATABASE_URL, 'DATABASE_URL');
env.DIRECT_URL = ensureSslMode(env.DIRECT_URL, 'DIRECT_URL');

const child = spawn('npx', ['prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  env,
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});

child.on('error', (error) => {
  console.error('\n[run-migrate-deploy] Prisma migrate 実行中にエラーが発生しました:', error);
  process.exit(1);
});
