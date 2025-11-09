"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

type Audience = "ADMIN" | "CUSTOMER";

type LocationOption = {
  slug: string;
  label: string;
};

interface SignInFormProps {
  locationOptions: LocationOption[];
}

export function SignInForm({ locationOptions }: SignInFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audience, setAudience] = useState<Audience>("ADMIN");

  useEffect(() => {
    const preset = searchParams.get("audience");
    if (preset?.toLowerCase() === "customer") {
      setAudience("CUSTOMER");
    }
  }, [searchParams]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const locationSlug = formData.get("locationSlug");
    const targetAudience = audience;

    setIsSubmitting(true);
    setError(null);

    const result = await signIn("credentials", {
      email,
      password,
      audience: targetAudience,
      locationSlug:
        typeof locationSlug === "string" && locationSlug.length > 0 ? locationSlug : undefined,
      redirect: false,
    });

    setIsSubmitting(false);

    if (result?.error) {
      setError("ログインに失敗しました。メールアドレスとパスワードをご確認ください。");
      return;
    }

    router.push(targetAudience === "ADMIN" ? "/dashboard" : "/portal");
  }

  const isAdmin = audience === "ADMIN";

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-6">
      <div className="rounded-xl bg-slate-100 p-1 text-sm font-medium text-slate-600">
        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => setAudience("ADMIN")}
            className={`rounded-lg px-3 py-2 transition ${
              isAdmin ? "bg-white text-slate-900 shadow" : "hover:bg-white/70"
            }`}
          >
            管理者ログイン
          </button>
          <button
            type="button"
            onClick={() => setAudience("CUSTOMER")}
            className={`rounded-lg px-3 py-2 transition ${
              !isAdmin ? "bg-white text-slate-900 shadow" : "hover:bg-white/70"
            }`}
          >
            お客様ログイン
          </button>
        </div>
      </div>
      <div className="space-y-2">
        <label htmlFor="email" className="block text-sm font-medium text-slate-700">
          メールアドレス
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
          placeholder={
            isAdmin
              ? process.env.NEXT_PUBLIC_DEMO_ADMIN_EMAIL ?? "tenant-admin@example.com"
              : process.env.NEXT_PUBLIC_DEMO_CUSTOMER_EMAIL ?? "customer@example.com"
          }
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="password" className="block text-sm font-medium text-slate-700">
          パスワード
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
          placeholder={isAdmin ? "change-me" : "customer-pass"}
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="locationSlug" className="block text-sm font-medium text-slate-700">
          ご利用店舗
        </label>
        {locationOptions.length > 0 ? (
          <select
            id="locationSlug"
            name="locationSlug"
            required={isAdmin}
            defaultValue=""
            className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="" disabled>
              店舗を選択してください
            </option>
            {locationOptions.map((option) => (
              <option key={option.slug} value={option.slug}>
                {option.label}
              </option>
            ))}
          </select>
        ) : (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            選択可能な店舗がまだ登録されていません。管理者にお問い合わせください。
          </div>
        )}
        <p className="text-xs text-slate-500">
          {isAdmin
            ? "管理者ログインでは操作する店舗を必ず選択してください。"
            : "お客様は初回登録時にご利用店舗を選択してください。変更したい場合もこちらから選択できます。"}
        </p>
      </div>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? "ログイン中..." : "ログイン"}
      </button>
    </form>
  );
}
