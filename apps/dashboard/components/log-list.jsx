'use client';

import { useState } from 'react';

export function LogList({ logs }) {
  const [showAll, setShowAll] = useState(false);
  const displayedLogs = showAll ? logs : logs.slice(0, 3);
  
  return (
    <div className="glass-panel motion-enter rounded-3xl p-5">
      <div className="relative z-10 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-ink">Delivery Logs</h2>
          <p className="mt-1 text-sm text-ink/65">Opened, clicked, sent, and failed messages with project context.</p>
        </div>
      </div>
      <div className="relative z-10 mt-6 space-y-4">
        {displayedLogs.length ? displayedLogs.map((log) => (
          <article key={log.id} className="glass-inner rounded-2xl p-4 transition hover:bg-white/80">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-ink">{log.project?.client?.brandName ?? 'Unknown Brand'}</p>
                <p className="mt-1 text-sm text-ink/65">{log.subject}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.22em] text-ink/45">
                  {log.project?.projectCode ?? 'NO-CODE'} | {log.recipientEmail}
                </p>
              </div>
              <span className="rounded-xl bg-white/80 px-3 py-1 text-xs font-semibold text-ink shadow-sm">
                {log.status}
              </span>
            </div>
            {log.errorMessage ? (
              <p className="mt-3 text-sm text-coral">{log.errorMessage}</p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-ink/55">
              <span>Created: {new Date(log.createdAt).toLocaleString()}</span>
              {log.openedAt ? <span>Opened: {new Date(log.openedAt).toLocaleString()}</span> : null}
            </div>
          </article>
        )) : (
          <div className="glass-inner rounded-2xl border-dashed p-6 text-sm text-ink/60">
            No delivery logs yet. Sent and failed messages will appear here once the automation runs.
          </div>
        )}
        
        {logs.length > 3 && (
          <button 
            onClick={() => setShowAll(!showAll)}
            className="w-full mt-2 py-3 rounded-xl border border-gray-200 bg-white/40 hover:bg-white text-sm font-medium text-ink transition-all flex items-center justify-center gap-2"
          >
            {showAll ? 'Show less' : `Show ${logs.length - 3} more logs`}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition-transform duration-300 ${showAll ? 'rotate-180' : ''}`}>
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
