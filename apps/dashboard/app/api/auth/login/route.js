import { NextResponse } from 'next/server';
import { loginWithBackend, persistAuthCookies } from '@/lib/server-auth';

export async function POST(request) {
  const body = await request.json();
  const result = await loginWithBackend(body);

  if (!result.response.ok) {
    return NextResponse.json(
      { message: result.payload?.message ?? 'Unable to log in.' },
      { status: result.response.status }
    );
  }

  const response = NextResponse.json({
    user: result.payload.user
  });

  persistAuthCookies(response, result.payload.tokens);

  return response;
}
