import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  color: string;
}

export function StatCard({ title, value, icon: Icon, color }: StatCardProps) {
  return (
    <div className="card flex items-center gap-4 animate-in fade-in slide-in-from-bottom-1 duration-300">
      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="w-6 h-6" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-gray-500 dark:text-slate-400">{title}</p>
        <p className="text-2xl font-bold text-gray-800 dark:text-slate-100 truncate">{value}</p>
      </div>
    </div>
  );
}