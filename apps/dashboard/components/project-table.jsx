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
  onManualSend,
  sendingProjectId
}) {
  if (!projects.length) {
    return (
      <div className="rounded-[32px] border border-white/60 bg-white/80 p-8 shadow-panel backdrop-blur">
        <h2 className="text-xl font-semibold text-ink">Delivery Queue</h2>
        <p className="mt-3 text-sm leading-7 text-ink/65">
          No live projects are in the queue yet. Add studio clients and create completed projects through the API to populate this view.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[32px] border border-white/60 bg-white/80 shadow-panel backdrop-blur">
      <div className="border-b border-ink/10 px-6 py-5">
        <h2 className="text-xl font-semibold text-ink">Delivery Queue</h2>
        <p className="mt-1 text-sm text-ink/65">Live queue of projects eligible for delivery or waiting on a manual decision.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-sand/60 text-ink/65">
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
            {projects.map((project) => {
              const isSelected = project.id === selectedProjectId;
              const isSending = project.id === sendingProjectId;
              const followUpSatisfied = !project.requiresFollowUp || Boolean(project.followUpSentAt);
              const isEligible = project.status === 'COMPLETED' && followUpSatisfied;
              const isProcessing = project.dispatch?.status === 'PROCESSING';
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
                  ? 'Waiting follow-up'
                  : project.dispatch?.status ?? 'Not queued';
              const sendLabel = project.deliveryEmailSent
                ? 'Already Sent'
                : isSending || isProcessing
                  ? 'Processing...'
                  : !followUpSatisfied
                    ? 'Follow-up Needed'
                    : project.status !== 'COMPLETED'
                      ? 'Not Completed'
                      : 'Send Email';

              return (
                <tr
                  key={project.id}
                  className={`border-t border-ink/10 align-top ${isSelected ? 'bg-[#f7f3eb]' : ''}`}
                >
                  <td className="px-6 py-5">
                    <p className="font-semibold text-ink">{project.title}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.22em] text-ink/50">{project.projectCode}</p>
                  </td>
                  <td className="px-6 py-5">
                    <p className="font-medium text-ink">{project.client.brandName}</p>
                    <p className="mt-1 text-ink/60">{project.client.name}</p>
                    <p className="mt-1 text-xs text-ink/45">{project.client.email}</p>
                  </td>
                  <td className="px-6 py-5">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${badgeTone(project.status)}`}>
                      {project.status}
                    </span>
                    <p className="mt-3 text-xs text-ink/55">
                      Follow-up {project.requiresFollowUp ? (project.followUpSentAt ? 'sent' : 'pending') : 'not required'}
                    </p>
                  </td>
                  <td className="px-6 py-5 text-ink/70">{project.deliveryTemplateTone}</td>
                  <td className="px-6 py-5">
                    <p className="font-medium text-ink">{deliveryLabel}</p>
                    <p className="mt-1 text-xs text-ink/55">
                      {deliveryState}
                    </p>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => onManualSend(project)}
                        disabled={sendDisabled}
                        className="rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {sendLabel}
                      </button>
                      <button
                        type="button"
                        onClick={() => onEditProject(project.id)}
                        className="rounded-full border border-ink/15 px-4 py-2 text-xs font-semibold text-ink"
                      >
                        {isSelected ? 'Selected' : 'Edit Copy'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
