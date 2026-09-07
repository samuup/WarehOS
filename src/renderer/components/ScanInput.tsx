import { useState, type RefObject } from 'react';

interface ScanInputProps {
  value: string;
  onChange: (value: string) => void;
  onScan: (code: string) => void;
  autoFocus?: boolean;
  inputRef?: RefObject<HTMLInputElement>;
  placeholder?: string;
}

export function ScanInput({
  value,
  onChange,
  onScan,
  autoFocus = false,
  inputRef,
  placeholder = 'Escanea el código...',
}: ScanInputProps) {
  const [flash, setFlash] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const code = value.trim();
      if (code.length >= 3) {
        setFlash(true);
        window.setTimeout(() => setFlash(false), 400);
        onScan(code);
      }
    }
  };

  return (
    <div className={`relative ${flash ? 'ring-2 ring-green-500 rounded-lg' : ''}`}>
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500">
        <svg
          width="18"
          height="16"
          viewBox="0 0 18 16"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect x="0" y="1" width="2" height="14" />
          <rect x="4" y="1" width="3" height="14" />
          <rect x="9" y="1" width="1" height="14" />
          <rect x="12" y="1" width="2" height="14" />
          <rect x="16" y="1" width="2" height="14" />
        </svg>
      </span>
      <input
        ref={inputRef}
        type="text"
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="input-field pl-10"
      />
    </div>
  );
}