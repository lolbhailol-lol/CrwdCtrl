import React from 'react';
import { useDarkMode } from '../context/DarkModeContext';

const OPTIONS = [
    { value: 'Female', label: 'Female', emoji: '👩' },
    { value: 'Male', label: 'Male', emoji: '👨' },
];

export default function GenderQuickPick({ value, onChange, label = 'I am', error, compact = false }) {
    const { isDark } = useDarkMode();

    return (
        <div>
            <p className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {label} <span className="text-red-400">*</span>
            </p>
            <div className={`grid grid-cols-2 gap-2 ${compact ? '' : 'sm:gap-3'}`}>
                {OPTIONS.map((opt) => {
                    const selected = value === opt.value;
                    return (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => onChange(opt.value)}
                            className={`flex flex-col items-center justify-center rounded-xl border-2 transition-all ${
                                compact ? 'py-2.5 px-2' : 'py-3 px-3'
                            } ${
                                selected
                                    ? 'border-[#0ECCEE] bg-[#0ECCEE]/15 text-[#0ECCEE]'
                                    : isDark
                                        ? 'border-gray-600 bg-[#1D1E20] text-gray-300 hover:border-gray-500'
                                        : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300'
                            }`}
                        >
                            <span className={compact ? 'text-lg' : 'text-xl'}>{opt.emoji}</span>
                            <span className={`font-semibold ${compact ? 'text-xs mt-0.5' : 'text-sm mt-1'}`}>{opt.label}</span>
                        </button>
                    );
                })}
            </div>
            {error ? <p className="text-red-500 text-xs mt-1.5">{error}</p> : null}
        </div>
    );
}
