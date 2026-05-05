import { NextResponse } from 'next/server';
import { persistAuthCookies, signupWithBackend } from '@/lib/server-auth';

export async function POST(request) {
  const body = await request.json();
  const result = await signupWithBackend(body);

  if (!result.response.ok) {
    return NextResponse.json(
      { message: result.payload?.message ?? 'Unable to create account.' },
      { status: result.response.status }
    );
  }

  const response = NextResponse.json({
    user: result.payload.user
  }, { status: 201 });

  persistAuthCookies(response, result.payload.tokens);

  return response;
}
