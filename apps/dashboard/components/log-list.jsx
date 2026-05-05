export function LogList({ logs }) {
  return (
    <div className="rounded-[32px] border border-white/60 bg-white/80 p-6 shadow-panel backdrop-blur">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-ink">Delivery Logs</h2>
          <p className="mt-1 text-sm text-ink/65">Opened, clicked, sent, and failed messages with project context.</p>
        </div>
      </div>
      <div className="mt-6 space-y-4">
        {logs.length ? logs.map((log) => (
          <article key={log.id} className="rounded-3xl border border-ink/10 bg-sand/45 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-ink">{log.project.client.brandName}</p>
                <p className="mt-1 text-sm text-ink/65">{log.subject}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.22em] text-ink/45">
                  {log.project.projectCode} | {log.recipientEmail}
                </p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink">
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
          <div className="rounded-3xl border border-dashed border-ink/15 bg-sand/35 p-6 text-sm text-ink/60">
            No delivery logs yet. Sent and failed messages will appear here once the automation runs.
          </div>
        )}
      </div>
    </div>
  );
}
