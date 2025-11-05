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

function parseFailedMigrationsFromText(output = '') {
  const failed = [];
  const lines = output.split(/\r?\n/);
  let collecting = false;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!collecting) {
      if (/have failed/i.test(line) || /failed migrations/i.test(line)) {
        collecting = true;
      }
      continue;
    }
    if (!line) {
      break;
    }
    const match = line.match(/^[-•]\s*(.+)$/);
    if (match) {
      failed.push(match[1].trim());
      continue;
    }
    if (!/^[-•]/.test(line)) {
      break;
    }
  }
  return failed;
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
  const message = error?.message ?? '';
  if (/unknown or unexpected option:\s*--json/i.test(message)) {
    console.warn(
      '\n[run-migrate-deploy] prisma migrate status --json が利用できないため、テキスト出力で解析します。',
    );
    try {
      const fallbackOutput = error.stdout ?? runPrisma(['migrate', 'status'], { env });
      failedMigrations = parseFailedMigrationsFromText(fallbackOutput);
    } catch (fallbackError) {
      console.error('\n[run-migrate-deploy] prisma migrate status の取得に失敗しました。', fallbackError);
      exit(1);
    }
  } else {
    console.error('\n[run-migrate-deploy] prisma migrate status の取得に失敗しました。', error);
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
