import { ResetPasswordForm } from '@/components/reset-password-form';

export const metadata = {
  title: 'Reset Password',
  description: 'Reset access for the studio delivery console.'
};

export default function ResetPasswordPage({ searchParams }) {
  const token = typeof searchParams?.token === 'string' ? searchParams.token : '';

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="w-full max-w-xl rounded-[40px] border border-white/70 bg-[#132238] px-8 py-10 text-white shadow-panel md:px-10">
        <p className="text-xs uppercase tracking-[0.28em] text-white/55">Password Reset</p>
        <h1 className="mt-4 text-4xl leading-none">Create a new password</h1>
        <p className="mt-4 text-sm leading-7 text-white/70">
          Use the secure link from your email to set a fresh password for the studio dashboard.
        </p>
        <div className="mt-8">
          <ResetPasswordForm token={token} />
        </div>
      </section>
    </main>
  );
}
