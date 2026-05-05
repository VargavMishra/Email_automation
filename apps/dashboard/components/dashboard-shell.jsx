'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { EmailEditor } from '@/components/email-editor';
import { LogList } from '@/components/log-list';
import { OperationsPanel } from '@/components/operations-panel';
import { OverviewCards } from '@/components/overview-cards';
import { ProjectTable } from '@/components/project-table';
import {
  createClient,
  createProject,
  getDashboardData,
  getSession,
  logout,
  manualSendProject,
  updateProject
} from '@/lib/api';

const emptyOverview = {
  totalClients: 0,
  activeProjects: 0,
  readyToDeliver: 0,
  sentDeliveries: 0,
  failedDispatches: 0,
  templatePresets: [
    { key: 'FORMAL', label: 'Formal' },
    { key: 'FRIENDLY', label: 'Friendly' },
    { key: 'PREMIUM', label: 'Premium Client Tone' }
  ]
};

export function DashboardShell() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [overview, setOverview] = useState(emptyOverview);
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [logs, setLogs] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [sendingProjectId, setSendingProjectId] = useState(null);
  const [isSavingRecord, setIsSavingRecord] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState('connecting');
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [isLoggingOut, startLogoutTransition] = useTransition();

  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;

  async function loadDashboard({ silent = false } = {}) {
    if (silent) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError('');

    try {
      const [sessionResponse, dashboardResponse] = await Promise.all([
        getSession(),
        getDashboardData()
      ]);

      setSession(sessionResponse.user);
      setOverview(dashboardResponse.overview ?? emptyOverview);
      setClients(dashboardResponse.clients ?? []);
      setProjects(dashboardResponse.projects ?? []);
      setLogs(dashboardResponse.logs ?? []);
      setSelectedProjectId((current) => {
        if (current && (dashboardResponse.projects ?? []).some((project) => project.id === current)) {
          return current;
        }

        return dashboardResponse.projects?.[0]?.id ?? null;
      });
      setLastSyncedAt(new Date());
    } catch (requestError) {
      if (requestError.status === 401) {
        await logout().catch(() => {});
        startLogoutTransition(() => {
          router.replace('/login');
        });
        return;
      }

      setError(requestError.message);
    } finally {
      if (silent) {
        setIsRefreshing(false);
      } else {
        setIsLoading(false);
      }
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    let isClosed = false;
    let refreshTimer = null;
    const eventSource = new EventSource('/api/studio/events');

    function scheduleRefresh() {
      if (refreshTimer || document.visibilityState === 'hidden') {
        return;
      }

      refreshTimer = window.setTimeout(() => {
        refreshTimer = null;

        if (!isClosed) {
          loadDashboard({ silent: true });
        }
      }, 300);
    }

    eventSource.addEventListener('connected', () => {
      setRealtimeStatus('live');
    });

    eventSource.addEventListener('heartbeat', () => {
      setRealtimeStatus('live');
    });

    eventSource.addEventListener('studio.changed', () => {
      setRealtimeStatus('live');
      scheduleRefresh();
    });

    eventSource.onerror = () => {
      setRealtimeStatus(eventSource.readyState === EventSource.CLOSED ? 'offline' : 'reconnecting');
    };

    const fallbackTimer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadDashboard({ silent: true });
      }
    }, 15000);

    return () => {
      isClosed = true;
      eventSource.close();
      window.clearInterval(fallbackTimer);

      if (refreshTimer) {
        window.clearTimeout(refreshTimer);
      }
    };
  }, []);

  async function handleLogout() {
    await logout().catch(() => {});
    startLogoutTransition(() => {
      router.replace('/login');
    });
  }

  async function handleManualSend({ projectId, tone, subject, message }) {
    setSendingProjectId(projectId);
    setNotice('');
    setError('');

    try {
      const response = await manualSendProject(projectId, {
        tone,
        subject,
        message
      });

      setNotice(response.result?.subject
        ? `Delivery sent successfully: ${response.result.subject}`
        : 'Delivery sent successfully.');
      await loadDashboard();
    } catch (requestError) {
      if (requestError.status === 401) {
        await handleLogout();
        return;
      }

      setError(requestError.message);
    } finally {
      setSendingProjectId(null);
    }
  }

  async function handleCreateClient(body) {
    setIsSavingRecord(true);
    setNotice('');
    setError('');

    try {
      const response = await createClient(body);
      setNotice(`Client added: ${response.client?.brandName ?? body.brandName}.`);
      await loadDashboard();
    } catch (requestError) {
      if (requestError.status === 401) {
        await handleLogout();
        return false;
      }

      setError(requestError.message);
      return false;
    } finally {
      setIsSavingRecord(false);
    }

    return true;
  }

  async function handleCreateProject(body) {
    setIsSavingRecord(true);
    setNotice('');
    setError('');

    try {
      const response = await createProject(body);
      setNotice(`Project added: ${response.project?.projectCode ?? body.projectCode}.`);
      await loadDashboard();
      setSelectedProjectId(response.project?.id ?? null);
    } catch (requestError) {
      if (requestError.status === 401) {
        await handleLogout();
        return false;
      }

      setError(requestError.message);
      return false;
    } finally {
      setIsSavingRecord(false);
    }

    return true;
  }

  async function handleUpdateProject(projectId, body) {
    setIsSavingRecord(true);
    setNotice('');
    setError('');

    try {
      const response = await updateProject(projectId, body);
      setSelectedProjectId(response.project?.id ?? projectId);
      setNotice(`Project updated: ${response.project?.projectCode ?? 'selected project'}.`);
      await loadDashboard();
    } catch (requestError) {
      if (requestError.status === 401) {
        await handleLogout();
        return false;
      }

      setError(requestError.message);
      return false;
    } finally {
      setIsSavingRecord(false);
    }

    return true;
  }

  if (isLoading) {
    return (
      <main className="px-4 py-8 md:px-8 xl:px-10">
        <section className="mx-auto max-w-7xl animate-pulse space-y-8">
          <div className="h-72 rounded-[40px] bg-[#132238]" />
          <div className="grid gap-4 md:grid-cols-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-32 rounded-[28px] bg-white/70" />
            ))}
          </div>
          <div className="grid gap-8 xl:grid-cols-[1.45fr_0.55fr]">
            <div className="h-[540px] rounded-[32px] bg-white/70" />
            <div className="h-[540px] rounded-[32px] bg-white/70" />
          </div>
        </section>
      </main>
    );
  }

  const realtimeLabel = realtimeStatus === 'live'
    ? (isRefreshing ? 'Syncing...' : 'Live')
    : realtimeStatus === 'reconnecting'
      ? 'Reconnecting'
      : realtimeStatus === 'offline'
        ? 'Offline'
        : 'Connecting';
  const realtimeDotClass = realtimeStatus === 'live'
    ? 'bg-sage'
    : realtimeStatus === 'reconnecting'
      ? 'bg-coral'
      : 'bg-white/35';
  const lastSyncedLabel = lastSyncedAt
    ? lastSyncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : 'Waiting';

  return (
    <main className="px-4 py-8 md:px-8 xl:px-10">
      <section className="mx-auto max-w-7xl">
        <div className="relative overflow-hidden rounded-[40px] border border-white/70 bg-[#132238] px-6 py-8 text-white shadow-panel md:px-10">
          <div className="absolute inset-y-0 right-[-10%] w-[40%] rounded-full bg-coral/20 blur-3xl" />
          <div className="absolute left-[45%] top-[-30%] h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          <div className="relative z-10 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="text-xs uppercase tracking-[0.34em] text-white/60">E-commerce Photography Studio</p>
              <h1 className="mt-4 max-w-3xl text-5xl leading-none md:text-7xl">
                Delivery automation with human-level polish.
              </h1>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-white/70 md:text-base">
                Track completed shoots, validate Drive access, personalize delivery emails, and step in manually only when a project truly needs attention.
              </p>
            </div>
            <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 backdrop-blur">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-white/55">Automation Mode</p>
                  <p className="mt-4 text-4xl font-semibold">{overview.readyToDeliver}</p>
                  <p className="mt-2 text-sm text-white/65">projects are eligible for immediate delivery.</p>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-white"
                >
                  {isLoggingOut ? 'Signing out...' : 'Sign Out'}
                </button>
              </div>
              <div className="mt-6 space-y-3 text-sm text-white/70">
                <div className="flex items-center justify-between">
                  <span>Logged in as</span>
                  <span>{session?.name ?? session?.email ?? 'Studio Admin'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Drive validation</span>
                  <span>Enabled</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Retry pipeline</span>
                  <span>Exponential backoff</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Data source</span>
                  <span>Live API</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Dashboard sync</span>
                  <span className="inline-flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${realtimeDotClass}`} />
                    {realtimeLabel}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Last updated</span>
                  <span>{lastSyncedLabel}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {error ? (
          <div className="mt-6 rounded-[28px] border border-coral/20 bg-[#fff1ec] px-5 py-4 text-sm text-[#9f4025]">
            {error}
          </div>
        ) : null}

        {notice ? (
          <div className="mt-6 rounded-[28px] border border-sage/25 bg-[#edf4f0] px-5 py-4 text-sm text-[#395b4f]">
            {notice}
          </div>
        ) : null}

        <div className="mt-8">
          <OverviewCards overview={overview} />
        </div>

        <div className="mt-8">
          <OperationsPanel
            clients={clients}
            projects={projects}
            selectedProject={selectedProject}
            onSelectProject={setSelectedProjectId}
            onCreateClient={handleCreateClient}
            onCreateProject={handleCreateProject}
            onUpdateProject={handleUpdateProject}
            isSaving={isSavingRecord}
          />
        </div>

        <div className="mt-8 grid gap-8 xl:grid-cols-[1.45fr_0.55fr]">
          <div className="space-y-8">
            <ProjectTable
              projects={projects}
              selectedProjectId={selectedProjectId}
              onEditProject={setSelectedProjectId}
              onManualSend={(project) => handleManualSend({
                projectId: project.id,
                tone: project.deliveryTemplateTone
              })}
              sendingProjectId={sendingProjectId}
            />
            <LogList logs={logs} />
          </div>
          <div className="space-y-8">
            <EmailEditor
              templates={overview.templatePresets}
              project={selectedProject}
              isSending={sendingProjectId === selectedProject?.id}
              onSend={handleManualSend}
            />
            <div className="rounded-[32px] border border-white/60 bg-white/80 p-6 shadow-panel backdrop-blur">
              <p className="text-xs uppercase tracking-[0.3em] text-ink/45">Operations Playbook</p>
              <ul className="mt-5 space-y-3 text-sm leading-7 text-ink/75">
                <li>Only completed projects with follow-up satisfied are queued.</li>
                <li>Tracking routes register opens and Drive link clicks server-side.</li>
                <li>Failed sends stay retryable until the dispatch reaches the max retry count.</li>
                <li>Select a project from the queue to tailor the final delivery message.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
