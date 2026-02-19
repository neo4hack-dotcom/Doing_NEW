
import React, { useState } from 'react';
import { User } from '../types';
import { Lock, User as UserIcon, ArrowRight, AlertTriangle } from 'lucide-react';

interface LoginProps {
  users: User[];
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ users, onLogin }) => {
  const [uid, setUid] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Simple case-insensitive match for UID
    const user = users.find(u => u.uid.toLowerCase() === uid.trim().toLowerCase());
    
    if (user && user.password === password) {
      onLogin(user);
    } else {
      setError('Identifiants incorrects.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-950 flex items-center justify-center p-4 fallback-container">
      <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-800 p-10 fallback-card relative overflow-hidden">
        
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-indigo-600 rounded-xl flex items-center justify-center mb-4 shadow-indigo-200 dark:shadow-none shadow-lg">
              <span className="text-white font-bold text-3xl tracking-tighter">D</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">DOINg</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">Reporting Management System</p>
          <div className="flex gap-2 mt-2">
             <p className="text-xs text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-800">Local Mode</p>
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label htmlFor="uid" className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-1.5 ml-1">
              Identifiant (UID)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <UserIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input 
                id="uid"
                name="username"
                type="text" 
                autoComplete="username"
                value={uid}
                onChange={e => setUid(e.target.value)}
                className="fallback-input block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-700 rounded-lg leading-5 bg-gray-50 dark:bg-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white dark:focus:bg-gray-900 transition-all text-gray-900 dark:text-white"
                placeholder="Ex: ADM001"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-1.5 ml-1">
              Mot de passe
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              <input 
                id="password"
                name="password"
                type="password" 
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="fallback-input block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-700 rounded-lg leading-5 bg-gray-50 dark:bg-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white dark:focus:bg-gray-900 transition-all text-gray-900 dark:text-white"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm font-medium rounded-lg border border-red-100 dark:border-red-900 flex items-center justify-center animate-in fade-in slide-in-from-top-1">
              {error}
            </div>
          )}

          <button 
            type="submit"
            className="fallback-btn group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-bold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all shadow-md hover:shadow-lg"
          >
            Se connecter
            <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </form>

        {/* Disclaimer Section */}
        <div className="mt-8 pt-4 border-t border-gray-100 dark:border-gray-800 text-center">
            <div className="flex items-center justify-center gap-2 text-amber-600 dark:text-amber-500 mb-1">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wide">Disclaimer</span>
            </div>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                No secret or confidential data allowed in this App.
            </p>
        </div>

      </div>
    </div>
  );
};

export default Login;
