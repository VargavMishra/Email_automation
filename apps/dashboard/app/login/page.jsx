import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/login-form';
import { authCookieNames } from '@/lib/server-auth';

export const metadata = {
  title: 'Studio Login',
  description: 'Sign in to the studio delivery console.'
};

export default function LoginPage() {
  const cookieStore = cookies();
  const hasSession =
    Boolean(cookieStore.get(authCookieNames.access)?.value) ||
    Boolean(cookieStore.get(authCookieNames.refresh)?.value);

  if (hasSession) {
    redirect('/');
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="grid w-full max-w-6xl gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="relative overflow-hidden rounded-[40px] border border-white/60 bg-[#132238] px-8 py-10 text-white shadow-panel md:px-10">
          <div className="absolute -left-10 top-0 h-48 w-48 rounded-full bg-coral/20 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
          <div className="relative z-10">
            <p className="text-xs uppercase tracking-[0.34em] text-white/55">Studio Delivery Console</p>
            <h1 className="mt-5 max-w-xl text-5xl leading-none md:text-6xl">
              Live delivery operations for client-ready photo projects.
            </h1>
            <p className="mt-6 max-w-xl text-sm leading-7 text-white/70 md:text-base">
              Sign in with your backend admin account to load real project queues, email logs, and manual delivery controls.
            </p>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              <div className="rounded-[28px] border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-white/45">Live Data</p>
                <p className="mt-3 text-sm text-white/80">Reads projects directly from the protected studio API.</p>
              </div>
              <div className="rounded-[28px] border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-white/45">Secure Session</p>
                <p className="mt-3 text-sm text-white/80">Access and refresh tokens stay in server-side cookies.</p>
              </div>
              <div className="rounded-[28px] border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-white/45">Manual Control</p>
                <p className="mt-3 text-sm text-white/80">Preview or send delivery messages from the real queue.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[40px] border border-white/70 bg-[#132238] px-8 py-10 text-white shadow-panel md:px-10">
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
