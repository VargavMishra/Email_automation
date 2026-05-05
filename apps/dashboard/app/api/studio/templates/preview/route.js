import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  authenticatedBackendRequest,
  authCookieNames,
  clearAuthCookies,
  persistAuthCookies,
  resolveAuthenticatedSession
} from '@/lib/server-auth';

export async function GET(request) {
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

  const search = request.nextUrl.searchParams.toString();
  const result = await authenticatedBackendRequest({
    path: `/api/studio/templates/preview${search ? `?${search}` : ''}`,
    accessToken: session.accessToken
  });

  if (!result.response.ok) {
    return NextResponse.json(
      { message: result.payload?.message ?? 'Unable to preview delivery email.' },
      { status: result.response.status }
    );
  }

  const response = NextResponse.json(result.payload);

  if (session.refreshedTokens) {
    persistAuthCookies(response, session.refreshedTokens);
  }

  return response;
}
