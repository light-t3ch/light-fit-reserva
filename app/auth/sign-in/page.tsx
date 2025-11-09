import { Suspense } from "react";

import { SignInForm } from "@/components/auth/sign-in-form";

import { prisma } from "@/lib/prisma";

async function getLocationOptions() {
  const locations = await prisma.location.findMany({
    select: { slug: true, name: true },
    orderBy: { name: "asc" },
  });

  return locations
    .filter((location) => Boolean(location.slug && location.name))
    .map((location) => ({ slug: location.slug, label: location.name }));
}

export default async function SignInPage() {
  const locationOptions = await getLocationOptions();

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6 py-12">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <h1 className="text-2xl font-semibold text-slate-900">Light Fit Reserva ログイン</h1>
        <p className="mt-2 text-sm text-slate-600">
          デモ環境では管理者・お客様どちらのログイン方法も選択できます。メールアドレスとパスワードはそれぞれ共有された値、または画面のヒントをご利用ください。
        </p>
        <Suspense
          fallback={
            <div className="mt-8 text-sm text-slate-600">読み込み中...</div>
          }
        >
          <SignInForm locationOptions={locationOptions} />
        </Suspense>
      </div>
    </main>
  );
}
