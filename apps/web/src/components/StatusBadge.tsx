import clsx from 'clsx';

const statusColors: Record<string, string> = {
  open: 'bg-red-100 text-red-700',
  assigned: 'bg-amber-100 text-amber-700',
  in_progress: 'bg-blue-100 text-blue-700',
  resolved: 'bg-emerald-100 text-emerald-700',
  closed: 'bg-gray-100 text-gray-600',
};

const categoryColors: Record<string, string> = {
  infrastructure: 'bg-orange-100 text-orange-700',
  electrical: 'bg-yellow-100 text-yellow-700',
  plumbing: 'bg-cyan-100 text-cyan-700',
  cleanliness: 'bg-green-100 text-green-700',
  network: 'bg-purple-100 text-purple-700',
  safety: 'bg-red-100 text-red-700',
  other: 'bg-gray-100 text-gray-600',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium', statusColors[status] || 'bg-gray-100 text-gray-600')}>
      {status.replace('_', ' ')}
    </span>
  );
}

export function CategoryBadge({ category }: { category: string }) {
  return (
    <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium', categoryColors[category] || 'bg-gray-100 text-gray-600')}>
      {category}
    </span>
  );
}
