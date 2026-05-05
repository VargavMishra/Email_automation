import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  authenticatedBackendRequest,
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

  const [overviewResult, clientsResult, projectsResult, logsResult] = await Promise.all([
    authenticatedBackendRequest({
      path: '/api/studio/overview',
      accessToken: session.accessToken
    }),
    authenticatedBackendRequest({
      path: '/api/studio/clients',
      accessToken: session.accessToken
    }),
    authenticatedBackendRequest({
      path: '/api/studio/projects',
      accessToken: session.accessToken
    }),
    authenticatedBackendRequest({
      path: '/api/studio/logs',
      accessToken: session.accessToken
    })
  ]);

  const failingResult = [overviewResult, clientsResult, projectsResult, logsResult].find((result) => !result.response.ok);

  if (failingResult) {
    return NextResponse.json(
      { message: failingResult.payload?.message ?? 'Unable to load dashboard data.' },
      { status: failingResult.response.status }
    );
  }

  const response = NextResponse.json({
    overview: overviewResult.payload.overview,
    clients: clientsResult.payload.clients,
    projects: projectsResult.payload.projects,
    logs: logsResult.payload.logs
  });

  if (session.refreshedTokens) {
    persistAuthCookies(response, session.refreshedTokens);
  }

  return response;
}
