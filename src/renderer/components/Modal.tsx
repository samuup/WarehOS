import React from 'react';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}

export function Modal({ title, onClose, children, wide = false }: ModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`bg-white rounded-xl shadow-xl w-full dark:bg-slate-800 dark:border dark:border-slate-700 ${
          wide ? 'max-w-3xl' : 'max-w-md'
        } max-h-[90vh] overflow-y-auto p-6 animate-in zoom-in-95 slide-in-from-bottom-2 duration-200`}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-slate-100">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none dark:text-slate-500 dark:hover:text-slate-300"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}