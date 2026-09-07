import { useState } from 'react';
import { Search } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChange, placeholder = 'Buscar...' }: SearchBarProps) {
  const [focus, setFocus] = useState(false);
  return (
    <div className={`relative transition-shadow ${focus ? 'ring-2 ring-primary-500 rounded-lg' : ''}`}>
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500">
        <Search className="w-4 h-4" aria-hidden="true" />
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        placeholder={placeholder}
        className="input-field pl-10"
      />
    </div>
  );
}