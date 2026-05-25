interface Props {
  label:  string;
  value:  string | number;
  badge?: string;
  color?: 'green' | 'gold';
}

export default function KpiCard({ label, value, badge, color = 'green' }: Props) {
  const badgeColor = color === 'gold'
    ? 'bg-yellow-50 text-yellow-700'
    : 'bg-green-50 text-oli-green';

  return (
    <div className="bg-white rounded-2xl border border-oli-border p-5">
      <p className="text-[11px] font-bold text-oli-lgray uppercase tracking-wider mb-2.5">{label}</p>
      <p className="text-[30px] font-extrabold text-oli-dark leading-none">{value}</p>
      {badge && (
        <p className={`mt-2 inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeColor}`}>
          {badge}
        </p>
      )}
    </div>
  );
}
