'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { EmailEditor } from '@/components/email-editor';
import { LogList } from '@/components/log-list';
import { OperationsPanel } from '@/components/operations-panel';
import { OverviewCards } from '@/components/overview-cards';
import { ProjectTable } from '@/components/project-table';
import {
  createClient,
  createProject,
  deleteClient,
  deleteProject,
  getDashboardData,
  getSession,
  logout,
  manualSendProject,
  updateClient,
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
  const [sendingProjectId, setSendingProjectId] = useState(null)  ;
  const [isSavingRecord, setIsSavingRecord] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState('connecting');
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [isLoggingOut, startLogoutTransition] = useTransition();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [notifications, setNotifications] = useState([]);
  const lastSoundPlayedAt = useRef(0);
  const consecutiveAuthFailures = useRef(0);
  const backoffUntil = useRef(0);

  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;

  const playNotificationSound = useCallback(() => {
    const now = Date.now();
    // Cooldown of 2 seconds to avoid sound spamming
    if (now - lastSoundPlayedAt.current < 2000) return;
    
    const audio = new Audio('/sounds/emailsentnoti.mp3');
    audio.volume = 0.6;
    audio.play().catch(err => console.log('Audio playback failed:', err));
    lastSoundPlayedAt.current = now;
  }, []);

  async function loadDashboard({ silent = false } = {}) {
    // Respect backoff period from rate limiting
    if (Date.now() < backoffUntil.current) {
      return;
    }

    if (silent) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    // Only clear error on non-silent loads to avoid flicker
    if (!silent) {
      setError('');
    }

    try {
      // On silent refreshes, skip re-fetching session — we already have it.
      // This cuts API calls in half during background polling.
      if (silent) {
        const dashboardResponse = await getDashboardData();
        setOverview(dashboardResponse.overview ?? emptyOverview);
        setClients(dashboardResponse.clients ?? []);
        setProjects(dashboardResponse.projects ?? []);
        setLogs(dashboardResponse.logs ?? []);
        setSelectedProjectId((current) => {
          if (current && (dashboardResponse.projects ?? []).some((p) => p.id === current)) {
            return current;
          }
          return dashboardResponse.projects?.[0]?.id ?? null;
        });
      } else {
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
          if (current && (dashboardResponse.projects ?? []).some((p) => p.id === current)) {
            return current;
          }
          return dashboardResponse.projects?.[0]?.id ?? null;
        });
      }

      setLastSyncedAt(new Date());
      // Reset failure counter on success
      consecutiveAuthFailures.current = 0;
    } catch (requestError) {
      if (requestError.status === 429) {
        // Rate limited — back off for 2 minutes, show a gentle message
        backoffUntil.current = Date.now() + 2 * 60 * 1000;
        if (!silent) {
          setError('Too many requests. Dashboard will auto-resume in 2 minutes.');
        }
        return;
      }

      if (requestError.status === 401) {
        // Only force-logout after 3 consecutive 401s to avoid a single
        // transient failure booting the user out.
        consecutiveAuthFailures.current += 1;
        if (consecutiveAuthFailures.current >= 3) {
          await logout().catch(() => {});
          startLogoutTransition(() => {
            router.replace('/login');
          });
        }
        return;
      }

      // For all other errors, only show on non-silent loads
      if (!silent) {
        setError(requestError.message);
      }
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

    eventSource.addEventListener('studio.changed', (e) => {
      setRealtimeStatus('live');
      
      try {
        const event = JSON.parse(e.data);
        
        // Handle specific delivery success
        if (event.type === 'delivery.sent') {
          playNotificationSound();
          setNotifications(prev => [
            {
              id: event.id,
              title: 'Email Delivered',
              message: `Project ${event.payload.projectCode} sent to ${event.payload.recipientEmail}`,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              isNew: true
            },
            ...prev
          ].slice(0, 5)); // Keep last 5 notifications
        }
      } catch (err) {
        console.error('Error parsing event data:', err);
      }

      scheduleRefresh();
    });

    eventSource.onerror = () => {
      setRealtimeStatus(eventSource.readyState === EventSource.CLOSED ? 'offline' : 'reconnecting');
    };

    const fallbackTimer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadDashboard({ silent: true });
      }
    }, 60000); // 60s — SSE handles real-time; this is just a safety net

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

  async function handleUpdateClient(clientId, body) {
    setIsSavingRecord(true);
    setNotice('');
    setError('');

    try {
      const response = await updateClient(clientId, body);
      setNotice(`Client updated: ${response.client?.brandName ?? response.client?.name ?? 'selected client'}.`);
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

  async function handleDeleteClient(clientId) {
    if (!window.confirm('Are you sure you want to delete this client? This cannot be undone.')) {
      return false;
    }

    setIsSavingRecord(true);
    setNotice('');
    setError('');

    try {
      await deleteClient(clientId);
      setNotice('Client deleted successfully.');
      await loadDashboard();
      return true;
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
  }

  async function handleCreateProject(body) {
    const { sendImmediately = false, ...projectInput } = body;
    setIsSavingRecord(true);
    setNotice('');
    setError('');

    try {
      const response = await createProject(projectInput);
      let noticeMessage = `Project added: ${response.project?.projectCode ?? projectInput.projectCode}.`;

      if (sendImmediately && response.project?.id) {
        setSendingProjectId(response.project.id);

        try {
          const sendResponse = await manualSendProject(response.project.id, {
            tone: projectInput.deliveryTemplateTone
          });
          noticeMessage = sendResponse.result?.subject
            ? `Project added and delivery sent: ${sendResponse.result.subject}`
            : 'Project added and delivery sent.';
        } catch (sendError) {
          setError(`Project was added, but instant send failed: ${sendError.message}`);
        } finally {
          setSendingProjectId(null);
        }
      }

      setNotice(noticeMessage);
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

  async function handleDeleteProject(projectId) {
    if (!window.confirm('Are you sure you want to delete this project? All associated logs and activities will be removed.')) {
      return false;
    }

    setIsSavingRecord(true);
    setNotice('');
    setError('');

    try {
      await deleteProject(projectId);
      setNotice('Project deleted successfully.');
      await loadDashboard();
      return true;
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
  }

  if (isLoading) {
    return (
      <main className="min-h-screen overflow-x-hidden px-4 py-5 md:px-6 lg:px-8">
        <section className="mx-auto max-w-[1500px] animate-pulse space-y-5">
          <div className="glass-panel h-36 rounded-3xl" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="metric-card h-28 rounded-2xl" />
            ))}
          </div>
          <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.4fr)_minmax(380px,0.6fr)]">
            <div className="glass-panel h-[460px] rounded-3xl" />
            <div className="glass-panel h-[460px] rounded-3xl" />
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
    <main className="min-h-screen overflow-x-hidden flex justify-center items-center p-4 md:p-8">
      <section className="app-container w-full space-y-6">
        {/* Crextio Top Navigation */}
        <nav className="flex justify-between items-center mb-8 relative z-50">
          <div className="text-xl font-semibold px-6 py-2 border border-gray-200 rounded-full bg-white/50 backdrop-blur-sm">GlamFlame Studios</div>
          
          <div className="hidden lg:flex gap-2 bg-white/50 backdrop-blur-sm p-1.5 rounded-full">
            <a href="#" onClick={() => setActiveTab('dashboard')} className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-300 ${activeTab === 'dashboard' ? 'bg-zinc-800 text-white shadow-md' : 'text-zinc-800 hover:bg-black/5'}`}>Dashboard</a>
            <a href="#operations" onClick={() => setActiveTab('operations')} className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-300 ${activeTab === 'operations' ? 'bg-zinc-800 text-white shadow-md' : 'text-zinc-800 hover:bg-black/5'}`}>Operations</a>
            <a href="#projects" onClick={() => setActiveTab('projects')} className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-300 ${activeTab === 'projects' ? 'bg-zinc-800 text-white shadow-md' : 'text-zinc-800 hover:bg-black/5'}`}>Queue</a>
            <a href="#logs" onClick={() => setActiveTab('logs')} className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-300 ${activeTab === 'logs' ? 'bg-zinc-800 text-white shadow-md' : 'text-zinc-800 hover:bg-black/5'}`}>Logs</a>
            <a href="#templates" onClick={() => setActiveTab('templates')} className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-300 ${activeTab === 'templates' ? 'bg-zinc-800 text-white shadow-md' : 'text-zinc-800 hover:bg-black/5'}`}>Templates</a>
          </div>

          <div className="flex gap-3 items-center">
            {/* Notification Dropdown */}
            <div className="relative">
              <button onClick={() => { setIsNotifOpen(!isNotifOpen); setIsProfileOpen(false); }} className="relative w-10 h-10 rounded-full border border-gray-200 bg-white/50 hover:bg-white hover:shadow-sm flex justify-center items-center transition-all">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full border-2 border-white flex items-center justify-center shadow-sm">
                    {notifications.length}
                  </span>
                )}
              </button>
              {isNotifOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50 animate-in fade-in zoom-in duration-200">
                  <div className="p-4 border-b border-gray-50 flex justify-between items-center bg-zinc-50/50">
                    <h3 className="font-bold text-sm text-zinc-800">Notifications</h3>
                    {notifications.length > 0 && (
                      <button onClick={() => setNotifications([])} className="text-[10px] text-zinc-400 hover:text-zinc-600 font-bold uppercase tracking-wider transition-colors">Clear All</button>
                    )}
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {notifications.length > 0 ? notifications.map((n) => (
                      <div key={n.id} className="p-4 border-b border-gray-50 hover:bg-zinc-50 transition-colors">
                        <div className="flex justify-between items-start mb-1">
                          <p className="text-sm font-bold text-zinc-800">{n.title}</p>
                          <span className="text-[10px] text-zinc-400">{n.time}</span>
                        </div>
                        <p className="text-xs text-zinc-500 leading-relaxed">{n.message}</p>
                      </div>
                    )) : (
                      <div className="p-10 text-center">
                        <div className="w-12 h-12 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-3">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                        </div>
                        <p className="text-zinc-400 text-xs">No new notifications</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            {/* Profile Dropdown */}
            <div className="relative">
              <button onClick={() => { setIsProfileOpen(!isProfileOpen); setIsNotifOpen(false); }} className="w-10 h-10 rounded-full border border-gray-200 bg-white/50 hover:bg-white hover:shadow-sm flex justify-center items-center transition-all overflow-hidden">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
              </button>
              {isProfileOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-lg border border-gray-100 py-2 z-50">
                  <div className="px-4 py-2 border-b border-gray-50 mb-1">
                    <p className="text-sm font-medium">{session?.name || 'Studio Admin'}</p>
                    <p className="text-xs text-gray-500 truncate">{session?.email || 'admin@studio.com'}</p>
                  </div>
                  <button className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    Settings
                  </button>
                  <button onClick={handleLogout} disabled={isLoggingOut} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                    {isLoggingOut ? 'Signing out...' : 'Sign Out'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </nav>

        <header className="motion-enter mb-10">
          <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <h1 className="text-4xl font-medium leading-tight text-ink md:text-5xl">
                Welcome in, {session?.name?.split(' ')[0] || 'Sourav'}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/65">
                Manage clients, delivery links, email sends, logs, and live automation from one focused workspace.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="glass-inner rounded-2xl px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-ink/45">Ready Now</p>
                <p className="mt-1 text-2xl font-semibold text-ink">{overview.readyToDeliver}</p>
              </div>
            </div>
          </div>

          <div className="relative z-10 mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <div className="glass-inner rounded-2xl px-4 py-3 text-sm">
              <p className="text-ink/45">Logged in</p>
              <p className="mt-1 truncate font-semibold text-ink">{session?.name ?? session?.email ?? 'Studio Admin'}</p>
            </div>
            <div className="glass-inner rounded-2xl px-4 py-3 text-sm">
              <p className="text-ink/45">Drive validation</p>
              <p className="mt-1 font-semibold text-ink">Enabled</p>
            </div>
            <div className="glass-inner rounded-2xl px-4 py-3 text-sm">
              <p className="text-ink/45">Retry pipeline</p>
              <p className="mt-1 font-semibold text-ink">Exponential backoff</p>
            </div>
            <div className="glass-inner rounded-2xl px-4 py-3 text-sm">
              <p className="text-ink/45">Dashboard sync</p>
              <p className="mt-1 inline-flex items-center gap-2 font-semibold text-ink">
                <span className={`h-2 w-2 rounded-full ${realtimeStatus === 'live' ? 'live-dot' : ''} ${realtimeDotClass}`} />
                {realtimeLabel}
              </p>
            </div>
            <div className="glass-inner rounded-2xl px-4 py-3 text-sm">
              <p className="text-ink/45">Last updated</p>
              <p className="mt-1 font-semibold text-ink">{lastSyncedLabel}</p>
            </div>
          </div>
        </header>

        {error ? (
          <div className="glass-panel motion-enter rounded-2xl px-5 py-4 text-sm text-[#9f4025]">
            <div className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p>{error}</p>
              <button
                type="button"
                onClick={() => loadDashboard()}
                className="btn-accent rounded-xl px-4 py-2 text-sm font-semibold text-white"
              >
                Retry
              </button>
            </div>
          </div>
        ) : null}

        {notice ? (
          <div className="glass-panel motion-enter rounded-2xl px-5 py-4 text-sm text-[#395b4f]">
            <p className="relative z-10">{notice}</p>
          </div>
        ) : null}

        <OverviewCards overview={overview} />

        <div id="operations">
          <OperationsPanel
            clients={clients}
            projects={projects}
            selectedProject={selectedProject}
            onSelectProject={setSelectedProjectId}
            onCreateClient={handleCreateClient}
            onUpdateClient={handleUpdateClient}
            onDeleteClient={handleDeleteClient}
            onCreateProject={handleCreateProject}
            onUpdateProject={handleUpdateProject}
            onDeleteProject={handleDeleteProject}
            isSaving={isSavingRecord}
          />
        </div>

        <div className="flex flex-col gap-5">
          <div id="projects">
            <ProjectTable
              projects={projects}
              selectedProjectId={selectedProjectId}
              onEditProject={setSelectedProjectId}
              onDeleteProject={handleDeleteProject}
              onManualSend={(project) => handleManualSend({
                projectId: project.id,
                tone: project.deliveryTemplateTone
              })}
              sendingProjectId={sendingProjectId}
            />
          </div>
          <div id="logs">
            <LogList logs={logs} />
          </div>
          <div id="templates">
            <EmailEditor
              templates={overview.templatePresets}
              project={selectedProject}
              isSending={sendingProjectId === selectedProject?.id}
              onSend={handleManualSend}
            />
          </div>
          <div className="glass-panel motion-enter rounded-2xl p-5">
            <p className="relative z-10 text-xs uppercase tracking-[0.22em] text-ink/45">Delivery Rules</p>
            <div className="relative z-10 mt-4 grid gap-3 text-sm leading-6 text-ink/70">
              <p>Completed projects can send immediately after the Drive link is added.</p>
              <p>Client check-in is optional and only blocks delivery when you turn it on.</p>
              <p>Failed emails remain retryable and appear in delivery logs with the exact error.</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
