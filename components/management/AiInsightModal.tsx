
import React from 'react';
import { Bot, ShieldAlert, X, Download, Copy, Loader2 } from 'lucide-react';
import FormattedText from '../FormattedText';

interface AiInsightModalProps {
    isOpen: boolean;
    type: 'synthesis' | 'risk';
    content: string;
    isLoading: boolean;
    onClose: () => void;
}

const AiInsightModal: React.FC<AiInsightModalProps> = ({ isOpen, type, content, isLoading, onClose }) => {
    if (!isOpen) return null;

    const cleanTextForClipboard = (text: string) => {
        return text
            .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
            .replace(/###\s?/g, '') // Remove headers
            .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Remove links keeping text
            .trim();
    };

    const copyToClipboard = () => {
        const plainText = cleanTextForClipboard(content);
        navigator.clipboard.writeText(plainText);
        alert("Copied to clipboard (Plain Text)!");
    };

    const exportToDoc = () => {
        const element = document.createElement("a");
        const file = new Blob([content], {type: 'text/plain'});
        element.href = URL.createObjectURL(file);
        element.download = "Management_Insight.doc"; 
        document.body.appendChild(element);
        element.click();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-150">
                <div className={`p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center ${type === 'risk' ? 'bg-red-600' : 'bg-indigo-600'} rounded-t-2xl`}>
                    <h3 className="font-bold text-lg text-white flex items-center gap-2">
                        {type === 'risk' ? <ShieldAlert className="w-6 h-6" /> : <Bot className="w-6 h-6" />}
                        {type === 'risk' ? 'Critical Risk Assessment' : 'AI Management Synthesis'}
                    </h3>
                    <button onClick={onClose} className="text-white hover:text-slate-200">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-8 overflow-y-auto flex-1 bg-slate-50 dark:bg-slate-950">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-64">
                            <Loader2 className={`w-12 h-12 animate-spin mb-4 ${type === 'risk' ? 'text-red-500' : 'text-indigo-500'}`} />
                            <p className="text-slate-500 font-medium">
                                {type === 'risk' ? 'Auditing project risks and resource health...' : 'Analyzing team dynamics and reports...'}
                            </p>
                        </div>
                    ) : (
                        <div className="prose prose-slate dark:prose-invert max-w-none">
                            <FormattedText text={content} />
                        </div>
                    )}
                </div>
                <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-between gap-3 rounded-b-2xl">
                        <button onClick={onClose} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-300 font-medium transition-colors">Close</button>
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
                            className={`px-4 py-2 text-sm font-medium text-white rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50 ${type === 'risk' ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
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

export default AiInsightModal;
