
import React from 'react';
import { X, Copy, Download, Loader2, Bot, Sparkles } from 'lucide-react';
import FormattedText from '../FormattedText';

interface AiResultModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    content: string;
    isLoading: boolean;
    type: 'email' | 'synthesis';
}

const AiResultModal: React.FC<AiResultModalProps> = ({ isOpen, onClose, title, content, isLoading, type }) => {
    if (!isOpen) return null;

    const copyToClipboard = () => {
        // Strip basic markdown for clipboard (or keep it if preferred, using the raw text)
        const plainText = content.replace(/\*\*(.*?)\*\*/g, '$1').replace(/###\s?/g, '').replace(/\[(.*?)\]\(.*?\)/g, '$1').trim();
        navigator.clipboard.writeText(plainText);
        alert("Copied to clipboard!");
    };

    const exportToDoc = () => {
        const element = document.createElement("a");
        const file = new Blob([content], {type: 'text/plain'});
        element.href = URL.createObjectURL(file);
        element.download = `${title.replace(/\s/g, '_')}.doc`; 
        document.body.appendChild(element);
        element.click();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-200">
                <div className={`p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center ${type === 'synthesis' ? 'bg-gradient-to-r from-purple-600 to-indigo-600' : ''} rounded-t-2xl`}>
                    <h3 className={`font-bold text-lg flex items-center gap-2 ${type === 'synthesis' ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                        {type === 'email' ? <Bot className={`w-5 h-5 text-indigo-500`} /> : <Sparkles className="w-5 h-5 text-yellow-300" />}
                        {title}
                    </h3>
                    <button onClick={onClose} className={type === 'synthesis' ? 'text-white hover:text-indigo-200' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}>
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <div className="p-6 overflow-y-auto flex-1 bg-slate-50 dark:bg-slate-950">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-500 dark:text-slate-400">
                            <Loader2 className={`w-8 h-8 animate-spin mb-3 ${type === 'synthesis' ? 'text-purple-600' : 'text-indigo-500'}`} />
                            <p>Generating content...</p>
                        </div>
                    ) : (
                        <div className="prose prose-sm dark:prose-invert max-w-none bg-white dark:bg-slate-800 p-6 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                            <FormattedText text={content} />
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-between gap-3 bg-white dark:bg-slate-900 rounded-b-2xl">
                    <button 
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        Close
                    </button>
                    <div className="flex gap-2">
                        <button 
                            onClick={exportToDoc}
                            disabled={isLoading}
                            className="px-4 py-2 text-sm font-medium bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                            <Download className="w-4 h-4" />
                            Export (.doc)
                        </button>
                        <button 
                            onClick={copyToClipboard}
                            disabled={isLoading}
                            className={`px-4 py-2 text-sm font-medium text-white rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50 ${type === 'synthesis' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                        >
                            <Copy className="w-4 h-4" />
                            Copy
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AiResultModal;
