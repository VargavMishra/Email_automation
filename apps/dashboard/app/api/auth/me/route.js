import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  authCookieNames,
  clearAuthCookies,
  persistAuthCookies,
  resolveAuthenticatedSession
} from '@/lib/server-auth';

export async function GET() {
  const cookieStore = cookies();
  const accessToken = cookieStore.get(authCookieNames.access)?.value;
  const refreshToken = cookieStore.get(authCookieNames.refresh)?.value;
  const session = await resolveAuthenticatedSession({
    accessToken,
    refreshToken
  });

  if (!session.ok) {
    const response = NextResponse.json(
      { message: session.payload?.message ?? 'Authentication required.' },
      { status: session.status ?? 401 }
    );
    clearAuthCookies(response);
    return response;
  }

  const response = NextResponse.json({
    user: session.user
  });

  if (session.refreshedTokens) {
    persistAuthCookies(response, session.refreshedTokens);
  }

  return response;
}
