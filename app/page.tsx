import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <section className="mb-16 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Light Fit Reserva
          </h1>
          <p className="mt-6 text-lg leading-8 text-slate-600">
            多店舗向けのパーソナルジム予約・課金統合プラットフォーム。Supabase、Prisma、Stripe、NextAuthを活用し、
            予約枠やクレジットの自動管理を実現します。
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/auth/sign-in"
              className="rounded-md bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-500"
            >
              ログイン
            </Link>
            <Link
              href="/bookings"
              className="rounded-md border border-brand-200 px-6 py-3 text-sm font-semibold text-brand-700 hover:bg-brand-50"
            >
              予約画面を見る
            </Link>
          </div>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-lg">
          <h2 className="text-lg font-semibold text-slate-900">今すぐ始める理由</h2>
          <ul className="mt-4 space-y-3 text-sm text-slate-600">
            <li>・複数店舗のシフト・顧客・売上管理を一元化</li>
            <li>・Stripeサブスクと単発決済に連動したクレジット配分</li>
            <li>・21日/24日のタイミングに合わせた自動バッチ処理</li>
            <li>・NextAuthによる店舗別ログインと役割管理</li>
          </ul>
        </div>
      </section>
      <section className="grid gap-8 md:grid-cols-2">
        <div className="rounded-2xl bg-white p-8 shadow">
          <h3 className="text-xl font-semibold text-slate-900">トレーナーのシフト管理</h3>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            管理画面ではトレーナーごとのシフトを月次で入力し、予約可能枠を作成。24日21時の自動開放ロジックや
            特別追加枠にも対応しています。
          </p>
        </div>
        <div className="rounded-2xl bg-white p-8 shadow">
          <h3 className="text-xl font-semibold text-slate-900">お客様向け予約体験</h3>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            55分/25分などのプラン別メニューとトレーナー指名・指名なしを選択可能。前日22時以降のキャンセルポリシーを
            自動で適用し、予約クレジットの整合性を保ちます。
          </p>
        </div>
      </section>
    </main>
  );
}
