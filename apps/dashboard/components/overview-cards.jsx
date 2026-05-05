const labels = {
  totalClients: 'Clients',
  activeProjects: 'Active Projects',
  readyToDeliver: 'Ready To Deliver',
  sentDeliveries: 'Sent Deliveries',
  failedDispatches: 'Failed Dispatches'
};

const valueColors = [
  'bg-zinc-800 text-white',
  'bg-amber-300 text-zinc-800 border-amber-300',
  'bg-white/50 text-zinc-800',
  'bg-white/50 text-zinc-800',
  'bg-white/50 text-zinc-800'
];

export function OverviewCards({ overview }) {
  const entries = Object.entries(labels);
  
  return (
    <div className="flex flex-wrap items-center gap-4 lg:gap-8 mb-12 py-2">
      {entries.map(([key, label], index) => (
        <div key={key} className="flex items-center gap-4 lg:gap-8">
          <article 
            className="flex flex-col gap-2.5 motion-enter" 
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.15em] ml-1">{label}</span>
            <div className={`inline-flex items-center justify-center min-w-[64px] h-11 px-5 rounded-[20px] text-sm font-bold shadow-sm border border-black/5 transition-transform hover:scale-105 duration-300 ${valueColors[index % valueColors.length]}`}>
              {overview[key]}
            </div>
          </article>
          {index < entries.length - 1 && (
            <div className="h-10 w-[1.5px] bg-zinc-200/80 self-end mb-0.5 hidden md:block rounded-full" />
          )}
        </div>
      ))}
    </div>
  );
}
