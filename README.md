# Light Fit Reserva

多店舗向けパーソナルジムの予約・課金統合プラットフォームです。Next.js + Prisma + Supabase + Stripe + NextAuth をベースに、
月次/翌月のクレジット管理や 24 日・21 日の自動処理など、要件に沿った仕組みを実装するためのスターターを提供します。

- Next.js 14 App Router + TypeScript + Tailwind CSS
- Prisma (Supabase Postgres) を利用したデータモデル
- NextAuth（Prisma Adapter）による店舗アカウント認証
- Stripe / Supabase 連携用のサーバーライブラリと設定雛形
- 予約カレンダー、クレジット残高、管理ダッシュボード UI のモック

詳しい仕様は [`docs/system-architecture.md`](docs/system-architecture.md) を参照してください。

## セットアップ

```bash
npm install
npm run prisma:generate
npx prisma migrate deploy
```

環境変数は `.env` に設定してください。テンプレートとして [.env.example](.env.example) を用意しています。上記の `prisma migrate deploy` は
Supabase（Postgres）にテーブルを作成するので、`DATABASE_URL` / `DIRECT_URL` を適切に設定してから実行してください。
Prisma のデータソースには `directUrl` を指定しており、実行時は `DATABASE_URL`（コネクションプール経由）を使用しながら、
マイグレーション時は `DIRECT_URL`（5432 のメイン接続）を利用します。Supabase のダッシュボードでそれぞれの接続文字列を取得し、
環境変数へ設定してください。接続文字列に `sslmode=require` が含まれていない場合、Supabase 側との TLS 交渉で Prisma が
`unexpected message from server` を返すため、必ず `?sslmode=require`（既にクエリがある場合は `&sslmode=require`）を付与して
ください。`npm run vercel-build` を実行すると、同コマンド内で起動される `scripts/run-migrate-deploy.mjs` が自動的に
`sslmode=require` を補完しますが、環境変数に設定する際もあらかじめ含めておくことを推奨します。

Supabase / Stripe / NextAuth など外部サービスの接続情報はダミー値のままでは動作しないため、開発環境ごとに適切な値へ置き換えてください。

### Stripe 設定

チケット・サブスクの購入には Stripe を使用します。以下を設定してください。

1. 各プランに対応する Price を Stripe ダッシュボードで作成し、`.env` / Vercel の Environment Variables に `STRIPE_PRICE_...` の値を登録します。対応するキーは [.env.example](.env.example) に列挙しています。**値には `price_xxx` 形式の Price ID を設定し、Stripe Secret Key と同じモード（テスト / 本番）で発行された ID を指定してください。**
2. `STRIPE_SECRET_KEY` と `STRIPE_WEBHOOK_SECRET` を設定します。
3. Stripe Webhook を `https://{YOUR_DOMAIN}/api/stripe/webhook` に向け、`checkout.session.completed` / `invoice.paid` / `customer.subscription.updated` / `customer.subscription.deleted` のイベントを購読します。（互換用に `https://{YOUR_DOMAIN}/api/stripe-webhook` でも同じエンドポイントへ転送されます）

これにより、お客様ポータルの「チケットを購入」画面（`/portal/plans`）から Checkout を開始し、決済完了後にクレジットが自動付与されます。

## 開発サーバーの起動

```bash
npm run dev
```

- `http://localhost:3000/` : LP / 予約導線
- `http://localhost:3000/bookings` : 予約カレンダー UI モック
- `http://localhost:3000/dashboard` : 管理ダッシュボード UI モック
- `http://localhost:3000/auth/sign-in` : NextAuth カスタムサインインページ
- `http://localhost:3000/portal/plans` : Stripe 決済によるプラン購入画面

## Prisma スキーマ

`prisma/schema.prisma` にはテナント・店舗・トレーナー・顧客・プラン・サブスク・クレジット台帳・予約・シフトなど、
要件に基づくエンティティとリレーションを定義しています。`prisma/migrations/20231104_init` に初期テーブル作成用の SQL を
コミットしているので、`npx prisma migrate deploy` を実行すれば本番環境でも同じ構造を適用できます。

## Lint / ビルド

```bash
npm run lint
npm run build
```

## デモログイン

NextAuth にはデモ用の Credentials Provider を設定しています。

- 管理者ログイン: `.env` に設定した `DEMO_TENANT_EMAIL` / `DEMO_TENANT_PASSWORD`
- お客様ログイン: `.env` に設定した `DEMO_CUSTOMER_EMAIL` / `DEMO_CUSTOMER_PASSWORD`

`/auth/sign-in` からログインすると、選択したロールに応じて Prisma 経由でテナント・ユーザー・お客様レコード
（CUSTOMER ロールのみ）が自動作成され、セッション情報に `tenantId` と `role` が付与されます。

## 次のステップ

- Supabase 上でトリガー・エッジ関数を設定し、Stripe Webhook と連動するクレジット加算処理を実装
- 予約作成サーバーアクションを作り、クレジット台帳の減算・キャンセルロジックを組み込み
- 管理者 UI にシフト登録、売上指標、顧客管理のリアルデータを表示
- マルチテナント対応した NextAuth 認可ポリシー、RBAC を導入
