import Link from "next/link";
import { ReactNode } from "react";
import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/lib/auth";
import { SignOutButton } from "@/components/auth/sign-out-button";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getServerAuthSession();

  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  const locationName = session.user.locationName ?? "店舗未設定";

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4 text-sm font-medium text-slate-700">
            <Link href="/dashboard" className="rounded-md px-3 py-2 hover:bg-slate-100">
              ダッシュボード
            </Link>
            <Link href="/bookings" className="rounded-md px-3 py-2 hover:bg-slate-100">
              予約管理
            </Link>
            <Link href="/customers" className="rounded-md px-3 py-2 hover:bg-slate-100">
              お客様管理
            </Link>
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-600">
            <div>
              <p className="font-semibold text-slate-800">{session.user.name ?? "ユーザー"}</p>
              <p className="text-xs uppercase tracking-wide text-brand-600">{locationName}</p>
            </div>
            <SignOutButton />
          </div>
        </nav>
      </header>
      <div>{children}</div>
    </div>
  );
}
