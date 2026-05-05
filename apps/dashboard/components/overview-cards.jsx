const labels = {
  totalClients: 'Clients',
  activeProjects: 'Active Projects',
  readyToDeliver: 'Ready To Deliver',
  sentDeliveries: 'Sent Deliveries',
  failedDispatches: 'Failed Dispatches'
};

export function OverviewCards({ overview }) {
  return (
    <div className="grid gap-4 md:grid-cols-5">
      {Object.entries(labels).map(([key, label]) => (
        <article
          key={key}
          className="rounded-[28px] border border-white/60 bg-white/80 p-5 shadow-panel backdrop-blur"
        >
          <p className="text-xs uppercase tracking-[0.28em] text-ink/55">{label}</p>
          <p className="mt-4 text-3xl font-semibold text-ink">{overview[key]}</p>
        </article>
      ))}
    </div>
  );
}
