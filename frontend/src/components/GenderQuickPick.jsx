import React from 'react';
import { useDarkMode } from '../context/DarkModeContext';

const OPTIONS = [
    { value: 'Female', label: 'Female', emoji: '👩' },
    { value: 'Male', label: 'Male', emoji: '👨' },
];

export default function GenderQuickPick({ value, onChange, label = 'I am', error, hint, compact = false }) {
    const { isDark } = useDarkMode();

    return (
        <div>
            <label className={`block text-[11px] font-semibold uppercase tracking-wider mb-1.5 transition-colors ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {label} <span className="text-[#0ECCEE] font-bold ml-1">*</span>
            </label>
            <div className={`grid grid-cols-2 gap-2 ${compact ? '' : 'sm:gap-3'}`}>
                {OPTIONS.map((opt) => {
                    const selected = value === opt.value;
                    return (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => onChange(opt.value)}
                            className={`flex flex-col items-center justify-center rounded-xl border transition-all duration-200 cursor-pointer active:scale-98 ${
                                compact ? 'py-2.5 px-2' : 'py-3 px-3'
                            } ${
                                selected
                                    ? 'border-[#0ECCEE] bg-[#0ECCEE]/10 shadow-[0_0_0_1px_rgba(14,204,238,0.25)] text-[#0ECCEE]'
                                    : isDark
                                        ? 'border-white/10 bg-[#15171C] text-gray-300 hover:border-white/20'
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
            {!error && hint ? (
                <p className={`text-xs mt-2 leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{hint}</p>
            ) : null}
        </div>
    );
}
