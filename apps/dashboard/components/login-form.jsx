'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { forgotPassword, login, signup } from '@/lib/api';

const authModes = {
  login: {
    eyebrow: 'Admin Login',
    title: 'Welcome back',
    description: 'Sign in with your studio account to manage deliveries, logs, and client handoff emails.',
    submitLabel: 'Sign In',
    pendingLabel: 'Signing in...'
  },
  signup: {
    eyebrow: 'Create Account',
    title: 'Set up access',
    description: 'Create a studio admin account and continue directly into the delivery console.',
    submitLabel: 'Create Account',
    pendingLabel: 'Creating account...'
  },
  forgot: {
    eyebrow: 'Password Help',
    title: 'Reset access',
    description: 'Enter your email and we will send a secure password reset link if the account exists.',
    submitLabel: 'Send Reset Link',
    pendingLabel: 'Sending link...'
  }
};

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPending, startTransition] = useTransition();
  const activeMode = authModes[mode];
  const isBusy = isSubmitting || isPending;

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    setIsSubmitting(true);

    try {
      if (mode === 'forgot') {
        await forgotPassword({ email });
        setNotice('If an account exists for that email, a reset link has been sent.');
        return;
      }

      if (mode === 'signup') {
        await signup({
          name,
          email,
          password
        });
      } else {
        await login({
          email,
          password
        });
      }

      startTransition(() => {
        router.replace('/');
      });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <div className="mb-7">
        <p className="text-xs uppercase tracking-[0.28em] text-white/55">{activeMode.eyebrow}</p>
        <h2 className="mt-4 text-4xl leading-none">{activeMode.title}</h2>
        <p className="mt-4 text-sm leading-7 text-white/70">{activeMode.description}</p>
      </div>

      <div className="mb-7 grid grid-cols-3 rounded-3xl border border-white/10 bg-white/5 p-1 text-xs font-semibold">
        {[
          ['login', 'Login'],
          ['signup', 'Create'],
          ['forgot', 'Forgot']
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setMode(key);
              setError('');
              setNotice('');
            }}
            className={`rounded-[20px] px-3 py-2.5 transition ${mode === key ? 'bg-white text-[#132238]' : 'text-white/60 hover:text-white'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <form className="space-y-5" onSubmit={handleSubmit}>
        {mode === 'signup' ? (
          <div>
            <label className="mb-2 block text-xs uppercase tracking-[0.24em] text-white/55" htmlFor="name">
              Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-3xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-white outline-none placeholder:text-white/30"
              placeholder="Studio admin"
            />
          </div>
        ) : null}

        <div>
          <label className="mb-2 block text-xs uppercase tracking-[0.24em] text-white/55" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-3xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-white outline-none placeholder:text-white/30"
            placeholder="admin@studio.com"
          />
        </div>

        {mode !== 'forgot' ? (
          <div>
            <label className="mb-2 block text-xs uppercase tracking-[0.24em] text-white/55" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-3xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-white outline-none placeholder:text-white/30"
              placeholder="Enter your password"
            />
          </div>
        ) : null}

        {error ? (
          <p className="rounded-3xl border border-coral/30 bg-coral/10 px-4 py-3 text-sm text-[#ffd8cf]">
            {error}
          </p>
        ) : null}

        {notice ? (
          <p className="rounded-3xl border border-sage/30 bg-sage/10 px-4 py-3 text-sm text-[#dceee7]">
            {notice}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isBusy}
          className="w-full rounded-full bg-coral px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isBusy ? activeMode.pendingLabel : activeMode.submitLabel}
        </button>
      </form>
    </div>
  );
}
