export default function TopBar({ title }) {
  return (
    <div className="h-10 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-6">
      <span className="text-sm font-semibold text-white">{title}</span>
      <div className="flex items-center gap-1.5">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
        </span>
        <span className="text-xs text-emerald-400 font-bold tracking-widest">LIVE</span>
      </div>
    </div>
  );
}
