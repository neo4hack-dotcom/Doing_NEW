
import React, { useState, useRef, useEffect } from 'react';
import { LLMConfig, ChatMessage, User } from '../types';
import { sendChatMessage, generateDocumentSynthesis } from '../services/llmService';
import FormattedText from './FormattedText';
import { X, Send, Paperclip, Minimize2, Maximize2, Sparkles, FileText, Image as ImageIcon, Trash2, Bot, Download, Copy, Eraser } from 'lucide-react';

interface AIChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  llmConfig: LLMConfig;
  currentUser: User | null;
}

const AIChatSidebar: React.FC<AIChatSidebarProps> = ({ isOpen, onClose, llmConfig, currentUser }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<{name: string, type: string, content: string, isImage: boolean}[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle Escape Key to close sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && isOpen) {
            onClose();
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSendMessage = async (isSynthesisRequest = false) => {
    if ((!input.trim() && attachedFiles.length === 0)) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      attachments: attachedFiles.map(f => ({ name: f.name, type: f.type, data: f.isImage ? f.content : undefined })), // Only keep base64 for images in simple struct
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      let responseText = '';
      
      // Construire le contexte des fichiers pour le prompt (si texte)
      let fileContext = '';
      const images: string[] = [];

      attachedFiles.forEach(f => {
          if (f.isImage) {
              // Extraction base64 pure sans header pour Ollama
              const base64 = f.content.split(',')[1]; 
              if(base64) images.push(base64);
          } else {
              fileContext += `\n--- CONTENU DU FICHIER: ${f.name} ---\n${f.content}\n----------------------------------\n`;
          }
      });

      if (isSynthesisRequest) {
          // Mode Synthèse Documentaire
          const contentToSynthesize = (input + "\n" + fileContext).trim();
          if (!contentToSynthesize && images.length === 0) {
              responseText = "Please provide text or a file to synthesize.";
          } else {
              responseText = await generateDocumentSynthesis(contentToSynthesize || "Image attached to analyze.", llmConfig);
          }
      } else {
          // Mode Chat Standard
          const finalPrompt = input + (fileContext ? `\n\nI have attached these files for context:\n${fileContext}` : '');
          responseText = await sendChatMessage(messages, finalPrompt, llmConfig, images);
      }

      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: responseText,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "Sorry, I couldn't process your request. Check the LLM configuration.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
      setAttachedFiles([]); // Clear files after send
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          const reader = new FileReader();
          
          reader.onload = (evt) => {
              const content = evt.target?.result as string;
              const isImage = file.type.startsWith('image/');
              
              // Pour les fichiers non-images et non-texte (ex: binaires), on ne peut pas lire le contenu facilement
              // On met un placeholder pour le prompt
              let finalContent = content;
              if (!isImage && !file.type.includes('text') && !file.name.match(/\.(txt|md|json|csv|js|ts|tsx)$/)) {
                  finalContent = "[Binary File Attached - Content not readable directly by browser]";
              }

              setAttachedFiles(prev => [...prev, {
                  name: file.name,
                  type: file.type,
                  content: finalContent,
                  isImage: isImage
              }]);
          };

          if (file.type.startsWith('image/')) {
              reader.readAsDataURL(file); // Base64 pour image
          } else {
              reader.readAsText(file); // Texte pour le reste (tentative)
          }
      }
      // Reset input
      e.target.value = '';
  };

  const removeFile = (idx: number) => {
      setAttachedFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const cleanTextForClipboard = (text: string) => {
      return text
          .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
          .replace(/###\s?/g, '') // Remove headers
          .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Remove links keeping text
          .trim();
  };

  const copyToClipboard = (text: string) => {
      const plainText = cleanTextForClipboard(text);
      navigator.clipboard.writeText(plainText);
      alert("Copied (Plain Text)!");
  }

  const exportToDoc = (text: string) => {
      const element = document.createElement("a");
      const file = new Blob([text], {type: 'text/plain'});
      element.href = URL.createObjectURL(file);
      element.download = "Chat_Response.doc"; 
      document.body.appendChild(element);
      element.click();
  }

  const handleClearChat = () => {
      if (window.confirm("Clear conversation history?")) {
          setMessages([]);
      }
  }

  return (
    <>
        {/* Backdrop */}
        {isOpen && (
            <div 
                className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity"
                onClick={onClose}
            />
        )}

        {/* Sidebar */}
        <div 
            className={`fixed right-0 top-0 h-full bg-white dark:bg-slate-900 shadow-2xl z-50 transition-all duration-300 transform flex flex-col border-l border-slate-200 dark:border-slate-800
                ${isOpen ? 'translate-x-0' : 'translate-x-full'}
                ${isExpanded ? 'w-[70%]' : 'w-[85%] md:w-[40%]'}
            `}
        >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                        <Bot className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 dark:text-white">DOINg Assistant</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            Online ({llmConfig.provider})
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={handleClearChat}
                        className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-500 hover:text-red-500 transition-colors"
                        title="Clear History"
                    >
                        <Trash2 className="w-5 h-5" />
                    </button>
                    <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1"></div>
                    <button 
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-500 transition-colors"
                        title={isExpanded ? "Collapse" : "Expand"}
                    >
                        {isExpanded ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                    </button>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 text-slate-500 hover:text-red-600 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 dark:bg-slate-900/50">
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 p-8">
                        <Sparkles className="w-12 h-12 mb-4 text-indigo-300" />
                        <p className="text-sm font-medium">I am your intelligent assistant.</p>
                        <p className="text-xs mt-2">Ask me about your projects, or drop a file to get a synthesis.</p>
                    </div>
                )}
                
                {messages.map((msg) => (
                    <div 
                        key={msg.id} 
                        className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                    >
                        <div 
                            className={`max-w-[85%] rounded-2xl p-4 shadow-sm text-sm
                                ${msg.role === 'user' 
                                    ? 'bg-indigo-600 text-white rounded-tr-none' 
                                    : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-700 rounded-tl-none'}
                            `}
                        >
                            {/* Affichage des pièces jointes envoyées */}
                            {msg.attachments && msg.attachments.length > 0 && (
                                <div className="mb-3 space-y-2">
                                    {msg.attachments.map((att, i) => (
                                        <div key={i} className={`flex items-center gap-2 p-2 rounded-lg ${msg.role === 'user' ? 'bg-indigo-700/50' : 'bg-slate-100 dark:bg-slate-700'}`}>
                                            {att.type.startsWith('image/') && att.data ? (
                                                <img src={att.data} alt={att.name} className="w-10 h-10 object-cover rounded" />
                                            ) : (
                                                <FileText className="w-5 h-5 opacity-70" />
                                            )}
                                            <span className="text-xs truncate max-w-[150px] font-mono">{att.name}</span>
                                        </div>
                                    ))}
                                    <hr className={`border-t ${msg.role === 'user' ? 'border-indigo-500' : 'border-slate-200 dark:border-slate-700'}`} />
                                </div>
                            )}
                            
                            {/* Utilisation de FormattedText pour le contenu assistant, texte brut pour utilisateur */}
                            {msg.role === 'assistant' ? (
                                <FormattedText text={msg.content} />
                            ) : (
                                <div className="whitespace-pre-wrap">{msg.content}</div>
                            )}

                            <div className={`text-[10px] mt-2 text-right opacity-60`}>
                                {msg.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </div>
                        </div>
                        {/* Toolbar for assistant messages */}
                        {msg.role === 'assistant' && (
                            <div className="flex gap-2 mt-1 ml-2">
                                <button 
                                    onClick={() => copyToClipboard(msg.content)}
                                    className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 p-1"
                                    title="Copy"
                                >
                                    <Copy className="w-3 h-3" />
                                </button>
                                <button 
                                    onClick={() => exportToDoc(msg.content)}
                                    className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 p-1"
                                    title="Export"
                                >
                                    <Download className="w-3 h-3" />
                                </button>
                            </div>
                        )}
                    </div>
                ))}
                
                {isLoading && (
                    <div className="flex justify-start">
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl rounded-tl-none border border-slate-100 dark:border-slate-700 shadow-sm flex items-center gap-2">
                            <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce delay-75"></div>
                            <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce delay-150"></div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
                {/* File Preview */}
                {attachedFiles.length > 0 && (
                    <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
                        {attachedFiles.map((file, idx) => (
                            <div key={idx} className="relative flex items-center gap-2 p-2 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 min-w-[120px]">
                                {file.isImage ? (
                                    <img src={file.content} alt="preview" className="w-8 h-8 rounded object-cover" />
                                ) : (
                                    <FileText className="w-8 h-8 text-slate-400" />
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium truncate text-slate-700 dark:text-slate-300">{file.name}</p>
                                    <p className="text-[10px] text-slate-400 uppercase">{file.name.split('.').pop()}</p>
                                </div>
                                <button 
                                    onClick={() => removeFile(idx)}
                                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="relative">
                    <textarea 
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage();
                            }
                        }}
                        placeholder="Type your message or drop a file..."
                        className="w-full p-4 pr-32 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none text-sm text-slate-900 dark:text-white max-h-32"
                        rows={3}
                    />
                    
                    {/* Action Buttons inside Input */}
                    <div className="absolute bottom-3 right-3 flex items-center gap-2">
                        <input 
                            type="file" 
                            ref={fileInputRef}
                            className="hidden"
                            onChange={handleFileSelect}
                            // Accept images and common text docs. PPT/PDF support is limited to upload UI only in this frontend demo
                            accept="image/*,.txt,.md,.json,.csv,.js,.ts,.tsx" 
                        />
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-700 rounded-lg transition-colors"
                            title="Attach file (Image/Text)"
                        >
                            <Paperclip className="w-5 h-5" />
                        </button>
                        <button 
                            onClick={() => handleSendMessage()}
                            disabled={!input.trim() && attachedFiles.length === 0}
                            className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Send className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Synthesis Button */}
                <button 
                    onClick={() => handleSendMessage(true)}
                    disabled={!input.trim() && attachedFiles.length === 0}
                    className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white rounded-xl text-sm font-bold shadow-md transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Sparkles className="w-4 h-4" />
                    Generate Synthesis (Context, Key Takeaways, Alerts)
                </button>
                <p className="text-[10px] text-center mt-2 text-slate-400">
                    For PDF/PPT, please copy-paste important text if content is not readable.
                </p>
            </div>
        </div>
    </>
  );
};

export default AIChatSidebar;
