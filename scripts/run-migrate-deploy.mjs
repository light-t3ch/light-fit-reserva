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

function runPrismaRaw(args, options = {}) {
  const result = spawnSync('npx', ['prisma', ...args], {
    encoding: 'utf8',
    ...options,
  });
  if (result.error) {
    throw result.error;
  }
  return result;
}

function runPrisma(args, options = {}) {
  const result = runPrismaRaw(args, options);
  if (result.status !== 0) {
    const error = new Error(
      `[run-migrate-deploy] prisma ${args.join(' ')} が異常終了しました (exit=${result.status}).\n${result.stderr}`,
    );
    error.stdout = result.stdout;
    error.stderr = result.stderr;
    error.exitCode = result.status;
    throw error;
  }
  return result.stdout;
}

function stripAnsi(value = '') {
  return value.replace(/\u001b\[[0-9;]*m/g, '');
}

function parseFailedMigrationsFromText(output = '') {
  const cleaned = stripAnsi(output);
  const matches = cleaned.match(/\b\d{8,}_[A-Za-z0-9_-]+/g) ?? [];
  return Array.from(new Set(matches));
}

const env = { ...process.env };
env.DATABASE_URL = ensureSslMode(env.DATABASE_URL, 'DATABASE_URL');
env.DIRECT_URL = ensureSslMode(env.DIRECT_URL, 'DIRECT_URL');

let failedMigrations = [];
try {
  const statusOutput = runPrisma(['migrate', 'status', '--json'], { env });
  const parsed = JSON.parse(statusOutput ?? '{}');
  const failed = parsed.failedMigrationNames;
  if (Array.isArray(failed)) {
    failedMigrations = failed;
  }
} catch (error) {
  const message = (error?.message ?? '').trim();
  console.warn(
    `\n[run-migrate-deploy] prisma migrate status --json が失敗しました (${message || '詳細不明'}). テキスト出力から解析を試みます。`,
  );
  try {
    const rawOutputChunks = [];
    if (error?.stdout && error.stdout.length > 0) {
      rawOutputChunks.push(error.stdout);
    }
    if (error?.stderr && error.stderr.length > 0) {
      rawOutputChunks.push(error.stderr);
    }

    const fallbackOutput = rawOutputChunks.length > 0
      ? rawOutputChunks.join('\n')
      : (() => {
          const result = runPrismaRaw(['migrate', 'status'], { env });
          if (result.stdout && result.stdout.length > 0) {
            rawOutputChunks.push(result.stdout);
          }
          if (result.stderr && result.stderr.length > 0) {
            rawOutputChunks.push(result.stderr);
          }
          if (result.status !== 0) {
            console.warn(
              `\n[run-migrate-deploy] prisma migrate status が exit=${result.status} で終了しましたが、出力から解析を続行します。`,
            );
          }
          return rawOutputChunks.join('\n');
        })();
    failedMigrations = parseFailedMigrationsFromText(fallbackOutput);
  } catch (fallbackError) {
    console.error('\n[run-migrate-deploy] prisma migrate status の取得に失敗しました。', fallbackError);
    exit(1);
  }
}

if (failedMigrations.length > 0) {
  console.warn(
    `\n[run-migrate-deploy] 過去に失敗したマイグレーションを検出しました: ${failedMigrations.join(', ')}\n` +
      '  prisma migrate resolve --rolled-back <name> を自動実行します。',
  );
  for (const name of failedMigrations) {
    runPrisma(['migrate', 'resolve', '--rolled-back', name], { env });
  }
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
