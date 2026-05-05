import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  authenticatedBackendStream,
  authCookieNames,
  clearAuthCookies,
  persistAuthCookies,
  resolveAuthenticatedSession
} from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

export async function GET(request) {
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
    return response;
  }

  const abortController = new AbortController();
  request.signal.addEventListener('abort', () => {
    abortController.abort();
  });

  const backendResponse = await authenticatedBackendStream({
    path: '/api/studio/events',
    accessToken: session.accessToken,
    signal: abortController.signal
  });

  if (!backendResponse.ok || !backendResponse.body) {
    return NextResponse.json(
      { message: 'Unable to open live studio event stream.' },
      { status: backendResponse.status || 502 }
    );
  }

  const response = new NextResponse(backendResponse.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    }
  });

  if (session.refreshedTokens) {
    persistAuthCookies(response, session.refreshedTokens);
  }

  return response;
}
