import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { authCookieNames, clearAuthCookies, logoutFromBackend } from '@/lib/server-auth';

export async function POST() {
  const cookieStore = cookies();
  const refreshToken = cookieStore.get(authCookieNames.refresh)?.value;

  try {
    await logoutFromBackend(refreshToken);
  } catch {
    // Cookie cleanup still needs to happen locally.
  }

  const response = NextResponse.json({ ok: true });
  clearAuthCookies(response);

  return response;
}
