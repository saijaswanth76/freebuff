/** KPI card used on every dashboard (value always comes from the API). */
export default function StatCard({ icon: Icon, label, value, hint, tone = 'green' }) {
  const tones = {
    green: { background: '#fff0e6', color: '#c2410c' },
    blue: { background: '#e7f1ff', color: '#0d6efd' },
    amber: { background: '#fff4e5', color: '#b45309' },
    red: { background: '#fdecec', color: '#b02a37' },
    slate: { background: '#f1f5f9', color: '#475569' },
  };
  const style = tones[tone] || tones.green;

  return (
    <div className="stat-card">
      <span className="stat-icon" style={{ background: style.background, color: style.color }}>
        {Icon ? <Icon size={20} /> : null}
      </span>
      <div className="min-w-0">
        <p className="text-sm text-slate-500">{label}</p>
        <p className="text-2xl font-extrabold text-slate-900 leading-tight">{value}</p>
        {hint ? <p className="text-xs text-slate-400 mt-0.5">{hint}</p> : null}
      </div>
    </div>
  );
}
