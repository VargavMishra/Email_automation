import { useState } from 'react';

function badgeTone(value) {
  if (value === 'COMPLETED') {
    return 'bg-sage/15 text-ink';
  }

  if (value === 'HOLD') {
    return 'bg-coral/15 text-coral';
  }

  return 'bg-ink/10 text-ink';
}

export function ProjectTable({
  projects,
  selectedProjectId,
  onEditProject,
  onDeleteProject,
  onManualSend,
  sendingProjectId
}) {
  const [showAll, setShowAll] = useState(false);
  const initialLimit = 5;
  const displayedProjects = showAll ? projects : projects.slice(0, initialLimit);

  if (!projects.length) {
    return (
      <div className="glass-panel motion-enter rounded-3xl p-6">
        <h2 className="relative z-10 text-xl font-semibold text-ink">Delivery Queue</h2>
        <p className="relative z-10 mt-3 text-sm leading-7 text-ink/65">
          No live projects are in the queue yet. Add a client and project from Studio Operations to populate this view.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-panel motion-enter rounded-3xl pb-2">
      <div className="relative z-10 border-b border-ink/10 px-6 py-5">
        <h2 className="text-xl font-semibold text-ink">Delivery Queue</h2>
        <p className="mt-1 text-sm text-ink/65">Live queue of projects eligible for delivery or waiting on a manual decision.</p>
      </div>
      <div className="relative z-10 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-white/50 text-ink/65 backdrop-blur">
            <tr>
              <th className="px-6 py-4 font-medium">Project</th>
              <th className="px-6 py-4 font-medium">Client</th>
              <th className="px-6 py-4 font-medium">Status</th>
              <th className="px-6 py-4 font-medium">Template</th>
              <th className="px-6 py-4 font-medium">Delivery</th>
              <th className="px-6 py-4 font-medium">Next Action</th>
            </tr>
          </thead>
          <tbody>
            {displayedProjects.map((project) => {
              const isSelected = project.id === selectedProjectId;
              const isSending = project.id === sendingProjectId;
              const followUpSatisfied = !project.requiresFollowUp || Boolean(project.followUpSentAt);
              const isEligible = project.status === 'COMPLETED' && followUpSatisfied;
              const lockTimestamp = project.dispatch?.lockedAt ? new Date(project.dispatch.lockedAt).getTime() : 0;
              const lockIsFresh = lockTimestamp > Date.now() - (2 * 60 * 1000);
              const isProcessing = project.dispatch?.status === 'PROCESSING' && lockIsFresh;
              const hasStaleProcessingLock = project.dispatch?.status === 'PROCESSING' && !lockIsFresh;
              const sendDisabled = project.deliveryEmailSent || isSending || isProcessing || !isEligible;
              const deliveryLabel = project.deliveryEmailSent
                ? 'Sent'
                : !followUpSatisfied
                  ? 'Blocked'
                  : project.status !== 'COMPLETED'
                    ? 'Waiting'
                    : 'Pending';
              const deliveryState = project.deliveryEmailSent
                ? project.dispatch?.status ?? 'Delivered'
                : !followUpSatisfied
                  ? 'Waiting client check-in'
                  : project.dispatch?.status ?? 'Not queued';
              const deliveryError = project.dispatch?.lastError
                ? String(project.dispatch.lastError).slice(0, 120)
                : '';
              const sendLabel = project.deliveryEmailSent
                ? 'Already Sent'
                : isSending || isProcessing
                  ? 'Processing...'
                  : hasStaleProcessingLock
                    ? 'Retry Send'
                  : !followUpSatisfied
                    ? 'Check-in Needed'
                    : project.status !== 'COMPLETED'
                      ? 'Not Completed'
                      : 'Send Email';

              return (
                <tr
                  key={project.id}
                  className={`border-t border-ink/10 align-top transition hover:bg-white/40 ${isSelected ? 'bg-white/55' : ''}`}
                >
                  <td className="px-6 py-5">
                    <p className="font-semibold text-ink">{project.title}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.22em] text-ink/50">{project.projectCode}</p>
                  </td>
                  <td className="px-6 py-5">
                    <p className="font-medium text-ink">{project.client?.brandName ?? 'Unknown Brand'}</p>
                    <p className="mt-1 text-ink/60">{project.client?.name ?? 'Deleted Client'}</p>
                    <p className="mt-1 text-xs text-ink/45">{project.client?.email ?? 'No Email'}</p>
                  </td>
                  <td className="px-6 py-5">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${badgeTone(project.status)}`}>
                      {project.status}
                    </span>
                    <p className="mt-3 text-xs text-ink/55">
                      Client check-in {project.requiresFollowUp ? (project.followUpSentAt ? 'done' : 'pending') : 'not required'}
                    </p>
                  </td>
                  <td className="px-6 py-5 text-ink/70">{project.deliveryTemplateTone}</td>
                  <td className="px-6 py-5">
                    <p className="font-medium text-ink">{deliveryLabel}</p>
                    <p className="mt-1 text-xs text-ink/55">
                      {deliveryState}
                    </p>
                    {deliveryError ? (
                      <p className="mt-1 text-xs text-coral/80" title={project.dispatch?.lastError}>
                        {deliveryError}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => onManualSend(project)}
                        disabled={sendDisabled}
                        className="btn-primary rounded-xl px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {sendLabel}
                      </button>
                      <button
                        type="button"
                        onClick={() => onEditProject(project.id)}
                        className="glass-inner rounded-xl px-4 py-2 text-xs font-semibold text-ink transition hover:bg-white/85"
                      >
                        {isSelected ? 'Selected' : 'Edit Copy'}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteProject(project.id)}
                        className="p-2 text-ink/30 hover:text-coral transition-colors"
                        title="Delete Project"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {projects.length > initialLimit && (
        <div className="px-6 py-4 border-t border-ink/5">
          <button 
            onClick={() => setShowAll(!showAll)}
            className="w-full py-3 rounded-xl border border-gray-200 bg-white/40 hover:bg-white dark:bg-white/5 dark:hover:bg-white/10 text-sm font-medium text-ink transition-all flex items-center justify-center gap-2"
          >
            {showAll ? 'Show less' : `Show ${projects.length - initialLimit} more projects`}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition-transform duration-300 ${showAll ? 'rotate-180' : ''}`}>
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
