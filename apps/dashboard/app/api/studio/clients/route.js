import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  authenticatedBackendRequest,
  authCookieNames,
  clearAuthCookies,
  persistAuthCookies,
  resolveAuthenticatedSession
} from '@/lib/server-auth';

async function getSessionOrResponse() {
  const cookieStore = cookies();
  const session = await resolveAuthenticatedSession({
    accessToken: cookieStore.get(authCookieNames.access)?.value,
    refreshToken: cookieStore.get(authCookieNames.refresh)?.value
  });

  if (!session.ok) {
    const response = NextResponse.json(
      { message: session.payload?.message ?? 'Authentication required.' },
      { status: session.status ?? 401 }
    );
    clearAuthCookies(response);
    return { response };
  }

  return { session };
}

export async function POST(request) {
  const { session, response } = await getSessionOrResponse();

  if (response) {
    return response;
  }

  const body = await request.json();
  const result = await authenticatedBackendRequest({
    path: '/api/studio/clients',
    method: 'POST',
    accessToken: session.accessToken,
    body
  });

  if (!result.response.ok) {
    return NextResponse.json(
      { message: result.payload?.error?.message ?? result.payload?.message ?? 'Unable to create client.' },
      { status: result.response.status }
    );
  }

  const successResponse = NextResponse.json(result.payload, { status: 201 });

  if (session.refreshedTokens) {
    persistAuthCookies(successResponse, session.refreshedTokens);
  }

  return successResponse;
}
