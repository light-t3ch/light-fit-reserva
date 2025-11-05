#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { exit } from 'node:process';

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

function runPrisma(args, options = {}) {
  const result = spawnSync('npx', ['prisma', ...args], {
    encoding: 'utf8',
    ...options,
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(
      `[run-migrate-deploy] prisma ${args.join(' ')} が異常終了しました (exit=${result.status}).\n${result.stderr}`,
    );
  }
  return result.stdout;
}

const env = { ...process.env };
env.DATABASE_URL = ensureSslMode(env.DATABASE_URL, 'DATABASE_URL');
env.DIRECT_URL = ensureSslMode(env.DIRECT_URL, 'DIRECT_URL');

let statusOutput;
try {
  statusOutput = runPrisma(['migrate', 'status', '--json'], { env });
} catch (error) {
  console.error('\n[run-migrate-deploy] prisma migrate status の取得に失敗しました。', error);
  exit(1);
}

try {
  const parsed = JSON.parse(statusOutput ?? '{}');
  const failed = parsed.failedMigrationNames;
  if (Array.isArray(failed) && failed.length > 0) {
    console.warn(
      `\n[run-migrate-deploy] 過去に失敗したマイグレーションを検出しました: ${failed.join(', ')}\n` +
        '  prisma migrate resolve --rolled-back <name> を自動実行します。',
    );
    for (const name of failed) {
      runPrisma(['migrate', 'resolve', '--rolled-back', name], { env });
    }
  }
} catch (error) {
  console.error('\n[run-migrate-deploy] migrate status の解析に失敗しました。', error);
  exit(1);
}

const child = spawn('npx', ['prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  env,
});

child.on('exit', (code) => {
  exit(code ?? 0);
});

child.on('error', (error) => {
  console.error('\n[run-migrate-deploy] Prisma migrate 実行中にエラーが発生しました:', error);
  process.exit(1);
});
