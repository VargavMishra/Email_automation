import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { DashboardShell } from '@/components/dashboard-shell';
import { authCookieNames } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  const cookieStore = cookies();
  const hasSession =
    Boolean(cookieStore.get(authCookieNames.access)?.value) ||
    Boolean(cookieStore.get(authCookieNames.refresh)?.value);

  if (!hasSession) {
    redirect('/login');
  }

  return <DashboardShell />;
}
