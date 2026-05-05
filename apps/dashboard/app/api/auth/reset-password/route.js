import { NextResponse } from 'next/server';
import { resetPasswordWithBackend } from '@/lib/server-auth';

export async function POST(request) {
  const body = await request.json();
  const result = await resetPasswordWithBackend(body);

  if (!result.response.ok) {
    return NextResponse.json(
      { message: result.payload?.message ?? 'Unable to reset password.' },
      { status: result.response.status }
    );
  }

  return NextResponse.json({
    ok: true
  });
}
