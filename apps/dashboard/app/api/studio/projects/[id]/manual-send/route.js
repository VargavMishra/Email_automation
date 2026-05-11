import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  authenticatedBackendRequest,
  authCookieNames,
  clearAuthCookies,
  persistAuthCookies,
  resolveAuthenticatedSession
} from '@/lib/server-auth';

export async function POST(request, { params }) {
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

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const result = await authenticatedBackendRequest({
    path: `/api/studio/projects/${params.id}/manual-send`,
    method: 'POST',
    accessToken: session.accessToken,
    body
  });

  if (!result.response.ok) {
    return NextResponse.json(
      { message: result.payload?.message ?? 'Unable to send delivery email.' },
      { status: result.response.status }
    );
  }

  const response = NextResponse.json(result.payload);

  if (session.refreshedTokens) {
    persistAuthCookies(response, session.refreshedTokens);
  }

  return response;
}
