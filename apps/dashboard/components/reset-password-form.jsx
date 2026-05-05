'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { resetPassword } from '@/lib/api';

export function ResetPasswordForm({ token }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPending, startTransition] = useTransition();
  const isBusy = isSubmitting || isPending;

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setNotice('');

    if (!token) {
      setError('Reset token is missing. Please request a new reset link.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      await resetPassword({
        token,
        password
      });

      setNotice('Password reset successfully. Redirecting to login...');
      startTransition(() => {
        router.replace('/login');
      });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div>
        <label className="mb-2 block text-xs uppercase tracking-[0.24em] text-white/55" htmlFor="password">
          New Password
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-3xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-white outline-none placeholder:text-white/30"
          placeholder="At least 8 characters"
        />
      </div>

      <div>
        <label className="mb-2 block text-xs uppercase tracking-[0.24em] text-white/55" htmlFor="confirm-password">
          Confirm Password
        </label>
        <input
          id="confirm-password"
          type="password"
          required
          minLength={8}
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          className="w-full rounded-3xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-white outline-none placeholder:text-white/30"
          placeholder="Repeat new password"
        />
      </div>

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
        {isBusy ? 'Resetting password...' : 'Reset Password'}
      </button>
    </form>
  );
}
