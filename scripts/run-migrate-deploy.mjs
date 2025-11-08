#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { exit } from 'node:process';

async function fetchFailedMigrationsFromDatabase(env) {
  const connectionUrl = env.DIRECT_URL || env.DATABASE_URL;
  if (!connectionUrl) {
    return [];
  }

  try {
    const { PrismaClient } = await import('@prisma/client');
    const client = new PrismaClient({
      datasources: {
        db: {
          url: connectionUrl,
        },
      },
    });

    try {
      const rows = await client.$queryRaw`SELECT "migration_name" FROM "_prisma_migrations" WHERE "finished_at" IS NULL AND "rolled_back_at" IS NULL ORDER BY "started_at" ASC`;
      return (rows ?? [])
        .map((row) => row?.migration_name)
        .filter((value) => typeof value === 'string');
    } finally {
      await client.$disconnect();
    }
  } catch (error) {
    console.warn('\n[run-migrate-deploy] 失敗マイグレーションのデータベース照会に失敗しました。', error);
    return [];
  }
}

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

async function main() {
  const env = { ...process.env };
  env.DATABASE_URL = ensureSslMode(env.DATABASE_URL, 'DATABASE_URL');
  env.DIRECT_URL = ensureSslMode(env.DIRECT_URL, 'DIRECT_URL');
  env.FORCE_COLOR = env.FORCE_COLOR || '0';

  let failedMigrations = [];
  let statusCommandFailed = false;

  try {
    const statusOutput = runPrisma(['migrate', 'status', '--json'], { env });
    const parsed = JSON.parse(statusOutput ?? '{}');
    const failed = parsed.failedMigrationNames;
    if (Array.isArray(failed)) {
      failedMigrations = failed;
    }
  } catch (error) {
    statusCommandFailed = true;
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
      if (failedMigrations.length === 0 && fallbackOutput) {
        console.warn('\n[run-migrate-deploy] 失敗マイグレーション名を出力から特定できませんでした。');
      }
    } catch (fallbackError) {
      console.error('\n[run-migrate-deploy] prisma migrate status の取得に失敗しました。', fallbackError);
      exit(1);
    }
  }

  if (failedMigrations.length === 0 && statusCommandFailed) {
    const viaDb = await fetchFailedMigrationsFromDatabase(env);
    if (viaDb.length > 0) {
      console.warn(
        `\n[run-migrate-deploy] データベースから失敗マイグレーションを検出しました: ${viaDb.join(', ')}`,
      );
      failedMigrations = viaDb;
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

  await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn('npx', ['prisma', 'migrate', 'deploy'], {
      stdio: 'inherit',
      env,
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolvePromise();
      } else {
        rejectPromise(new Error(`prisma migrate deploy exited with code ${code}`));
      }
    });

    child.on('error', (error) => {
      rejectPromise(error);
    });
  });
}

main().catch((error) => {
  console.error('\n[run-migrate-deploy] Prisma migrate 実行中にエラーが発生しました:', error);
  exit(1);
});
