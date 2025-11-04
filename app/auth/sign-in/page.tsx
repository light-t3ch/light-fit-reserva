import { SignInForm } from "@/components/auth/sign-in-form";

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6 py-12">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <h1 className="text-2xl font-semibold text-slate-900">Light Fit Reserva ログイン</h1>
        <p className="mt-2 text-sm text-slate-600">
          デモ環境では管理者・お客様どちらのログイン方法も選択できます。メールアドレスとパスワードはそれぞれ共有された値、または画面のヒントをご利用ください。
        </p>
        <SignInForm />
      </div>
    </main>
  );
}
