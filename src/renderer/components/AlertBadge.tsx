import React from 'react';

export function AlertBadge({
  type,
  children,
}: {
  type: 'success' | 'error' | 'warning' | 'info';
  children: React.ReactNode;
}) {
  const colors = {
    success: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800',
    error: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800',
    warning: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
    info: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
  };

  return (
    <div className={`px-3 py-2 rounded-lg border text-sm font-medium animate-in fade-in slide-in-from-top-1 duration-200 ${colors[type]}`}>
      {children}
    </div>
  );
}