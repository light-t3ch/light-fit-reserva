import { redirect } from "next/navigation";

import { updateCustomerLocationAction } from "./actions";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type PageProps = {
  searchParams?: {
    updated?: string;
    error?: string;
  };
};

const ERROR_MESSAGES: Record<string, string> = {
  missing_customer: "お客様情報が見つかりませんでした。",
  not_found: "対象のお客様を確認できませんでした。",
  invalid_location: "選択された店舗が無効です。",
  unauthorized: "操作権限がありません。",
};

export default async function CustomersPage({ searchParams }: PageProps) {
  const session = await getServerAuthSession();

  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  if (session.user.role === "CUSTOMER") {
    redirect("/portal");
  }

  const tenantId = session.user.tenantId;

  if (!tenantId) {
    redirect("/auth/sign-in");
  }

  const locationId = session.user.locationId;
  const locationName = session.user.locationName ?? "店舗未設定";

  if (!locationId) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-12">
        <section className="rounded-3xl border border-amber-200 bg-amber-50 px-6 py-8 text-center text-sm text-amber-700 shadow-sm">
          <h1 className="text-2xl font-semibold text-amber-900">店舗の選択が必要です</h1>
          <p className="mt-3">
            管理者アカウントに店舗が紐づいていません。ログアウト後にログイン画面で担当店舗を選択してください。
          </p>
        </section>
      </main>
    );
  }

  const [locations, customers] = await Promise.all([
    prisma.location.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true },
    }),
    prisma.customer.findMany({
      where: { tenantId, locationId },
      include: {
        user: { select: { email: true } },
        location: { select: { name: true } },
      },
      orderBy: [
        { lastName: "asc" },
        { firstName: "asc" },
      ],
    }),
  ]);

  const success = typeof searchParams?.updated === "string";
  const errorKey = typeof searchParams?.error === "string" ? searchParams.error : undefined;
  const errorMessage = errorKey ? ERROR_MESSAGES[errorKey] ?? ERROR_MESSAGES.invalid_location : null;

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-6 py-12">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-500">Customer Management</p>
        <h1 className="text-3xl font-semibold text-slate-900">お客様店舗設定</h1>
        <p className="text-sm text-slate-600">
          {locationName} に所属するお客様の店舗設定を確認・変更できます。別店舗へ移動した場合は更新後にリストから除外されます。
        </p>
      </header>

      {success && (
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          店舗情報を更新しました。
        </p>
      )}

      {errorMessage && (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{errorMessage}</p>
      )}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{locationName} のお客様一覧</h2>
          <span className="text-xs text-slate-500">{customers.length} 名</span>
        </div>
        {customers.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            現在この店舗に紐づくお客様はいません。
          </p>
        ) : (
          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">お客様</th>
                  <th className="px-4 py-3">メールアドレス</th>
                  <th className="px-4 py-3">現在の店舗</th>
                  <th className="px-4 py-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {customers.map((customer) => (
                  <tr key={customer.id}>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {customer.lastName} {customer.firstName}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{customer.user?.email ?? "未登録"}</td>
                    <td className="px-4 py-3 text-slate-600">{customer.location?.name ?? "未設定"}</td>
                    <td className="px-4 py-3">
                      <form action={updateCustomerLocationAction} className="flex items-center justify-end gap-3">
                        <input type="hidden" name="customerId" value={customer.id} />
                        <input type="hidden" name="redirectTo" value="/customers" />
                        <select
                          name="locationId"
                          defaultValue={customer.location?.id ?? locationId}
                          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
                        >
                          {locations.map((location) => (
                            <option key={location.id} value={location.id}>
                              {location.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="submit"
                          className="rounded-full bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                        >
                          更新
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
