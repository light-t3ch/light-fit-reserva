import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SignInForm } from "@/components/auth/sign-in-form";
import { prisma } from "@/lib/prisma";

interface StoreSignInPageProps {
  params: {
    locationSlug: string;
  };
}

async function getLocation(slug: string) {
  const normalized = slug.toLowerCase();

  const location = await prisma.location.findFirst({
    where: { slug: normalized },
    select: { slug: true, name: true, address: true },
  });

  if (!location) {
    return null;
  }

  return location;
}

export default async function StoreSignInPage({ params }: StoreSignInPageProps) {
  const location = await getLocation(params.locationSlug);

  if (!location) {
    notFound();
  }

  const locationOption = { slug: location.slug, label: location.name };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6 py-12">
      <div className="w-full max-w-md space-y-6 rounded-2xl bg-white p-8 shadow-xl">
        <div>
          <p className="text-sm font-medium text-brand-600">{location.name} ご利用のお客様</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">ログイン</h1>
          <p className="mt-2 text-sm text-slate-600">
            このページは {location.name} 専用のログインです。他店舗のチケットでは予約いただけません。
          </p>
        </div>
        <Suspense fallback={<div className="text-sm text-slate-600">読み込み中...</div>}>
          <SignInForm
            locationOptions={[locationOption]}
            defaultLocationSlug={location.slug}
            lockLocation
            forceAudience="CUSTOMER"
          />
        </Suspense>
        <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
          <p>
            管理者としてログインする場合は
            <Link href="/auth/sign-in" className="text-brand-600 underline">
              管理者ログインページ
            </Link>
            からアクセスしてください。
          </p>
        </div>
      </div>
    </main>
  );
}
