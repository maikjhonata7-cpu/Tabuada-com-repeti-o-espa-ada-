import React from 'react';
import { Delete } from 'lucide-react';

interface KeypadProps {
  onPress: (num: string) => void;
  onDelete: () => void;
  disabled?: boolean;
}

const Keypad: React.FC<KeypadProps> = ({ onPress, onDelete, disabled }) => {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0'];

  return (
    <div className="w-full max-w-sm mx-auto px-6 pb-6">
      <div className="grid grid-cols-3 gap-4">
        {keys.map((k) => (
          <button
            key={k}
            disabled={disabled || k === '.'} 
            onClick={() => onPress(k)}
            className={`
              h-16 rounded-2xl text-2xl font-bold shadow-sm active:scale-95 transition-all border border-slate-100
              ${k === '.' 
                ? 'bg-slate-50 text-slate-300 opacity-0' // Hidden dot as per design usually not needed for simple math
                : 'bg-white text-indigo-600 hover:bg-slate-50 hover:border-indigo-100'}
              ${k === '0' ? 'col-span-1' : ''}
            `}
          >
            {k}
          </button>
        ))}
        <button
          disabled={disabled}
          onClick={onDelete}
          className="h-16 rounded-2xl bg-rose-50 text-rose-500 border border-rose-100 flex items-center justify-center shadow-sm active:scale-95 transition-all hover:bg-rose-100"
        >
          <Delete size={24} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
};

export default Keypad;