
import React from 'react';
import { Globe, X } from 'lucide-react';

interface LanguagePickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (language: 'fr' | 'en') => void;
    title?: string;
}

const LanguagePickerModal: React.FC<LanguagePickerModalProps> = ({ isOpen, onClose, onSelect, title }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm border border-slate-200 dark:border-slate-700 p-6">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Globe className="w-5 h-5 text-indigo-500" />
                        {title || 'Output Language'}
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                    Choose the language for the AI output:
                </p>
                <div className="flex gap-3">
                    <button
                        onClick={() => onSelect('fr')}
                        className="flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all cursor-pointer group"
                    >
                        <span className="text-3xl">🇫🇷</span>
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300 group-hover:text-blue-600 dark:group-hover:text-blue-400">Français</span>
                    </button>
                    <button
                        onClick={() => onSelect('en')}
                        className="flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all cursor-pointer group"
                    >
                        <span className="text-3xl">🇬🇧</span>
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">English</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LanguagePickerModal;
