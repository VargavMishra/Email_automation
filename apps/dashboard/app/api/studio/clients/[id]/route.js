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

export async function PATCH(request, { params }) {
  const { session, response } = await getSessionOrResponse();

  if (response) {
    return response;
  }

  const body = await request.json();
  const result = await authenticatedBackendRequest({
    path: `/api/studio/clients/${params.id}`,
    method: 'PATCH',
    accessToken: session.accessToken,
    body
  });

  if (!result.response.ok) {
    return NextResponse.json(
      { message: result.payload?.error?.message ?? result.payload?.message ?? 'Unable to update client.' },
      { status: result.response.status }
    );
  }

  const successResponse = NextResponse.json(result.payload);

  if (session.refreshedTokens) {
    persistAuthCookies(successResponse, session.refreshedTokens);
  }

  return successResponse;
}

export async function DELETE(request, { params }) {
  const { session, response } = await getSessionOrResponse();

  if (response) {
    return response;
  }

  const result = await authenticatedBackendRequest({
    path: `/api/studio/clients/${params.id}`,
    method: 'DELETE',
    accessToken: session.accessToken
  });

  if (!result.response.ok) {
    return NextResponse.json(
      { message: result.payload?.error?.message ?? result.payload?.message ?? 'Unable to delete client.' },
      { status: result.response.status }
    );
  }

  const successResponse = new NextResponse(null, { status: 204 });

  if (session.refreshedTokens) {
    persistAuthCookies(successResponse, session.refreshedTokens);
  }

  return successResponse;
}
