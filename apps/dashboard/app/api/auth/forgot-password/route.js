import { NextResponse } from 'next/server';
import { forgotPasswordWithBackend } from '@/lib/server-auth';

export async function POST(request) {
  const body = await request.json();
  const result = await forgotPasswordWithBackend(body);

  if (!result.response.ok) {
    return NextResponse.json(
      { message: result.payload?.message ?? 'Unable to send reset email.' },
      { status: result.response.status }
    );
  }

  return NextResponse.json({
    ok: true
  });
}
