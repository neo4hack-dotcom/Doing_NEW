
import React from 'react';
import { Briefcase, Settings, BarChart3, LogOut, BookOpen, Layers, Library, ClipboardList, LayoutDashboard, Users } from 'lucide-react';
import { User, UserRole } from '../types';

interface SidebarProps {
  currentUser: User | null;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentUser, activeTab, onTabChange, onLogout }) => {
  const isAdmin = currentUser?.role === UserRole.ADMIN;
  const showManagement = isAdmin; 

  const navItemClass = (tab: string) => `
    flex items-center w-full px-4 py-2.5 mb-1 transition-colors rounded-md text-sm
    ${activeTab === tab 
      ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 font-semibold' 
      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200 font-medium'}
  `;

  return (
    <div className="w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 h-screen fixed left-0 top-0 flex flex-col z-50">
      <div className="h-16 flex items-center px-6 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-md flex items-center justify-center">
                <span className="text-white font-bold text-lg">D</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
                DOINg
            </h1>
        </div>
      </div>

      <nav className="flex-1 px-3 py-6 space-y-0.5 overflow-y-auto">
        <button onClick={() => onTabChange('dashboard')} className={navItemClass('dashboard')}>
          <BarChart3 className="w-4 h-4 mr-3" />
          Dashboard
        </button>

        {showManagement && (
            <button onClick={() => onTabChange('management')} className={navItemClass('management')}>
                <LayoutDashboard className="w-4 h-4 mr-3" />
                Management
            </button>
        )}

        <div className="pt-4 pb-1">
            <p className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Workspace</p>
        </div>

        <button onClick={() => onTabChange('projects')} className={navItemClass('projects')}>
          <Briefcase className="w-4 h-4 mr-3" />
          Projects & Tasks
        </button>
        
        <button onClick={() => onTabChange('book-of-work')} className={navItemClass('book-of-work')}>
          <Library className="w-4 h-4 mr-3" />
          Book of Work
        </button>

        <button onClick={() => onTabChange('working-groups')} className={navItemClass('working-groups')}>
          <Users className="w-4 h-4 mr-3" />
          Working Groups
        </button>
        
        <button onClick={() => onTabChange('weekly-report')} className={navItemClass('weekly-report')}>
          <ClipboardList className="w-4 h-4 mr-3" />
          Weekly Report
        </button>

        <button onClick={() => onTabChange('meetings')} className={navItemClass('meetings')}>
          <BookOpen className="w-4 h-4 mr-3" />
          Meetings
        </button>

        {isAdmin && (
          <div className="mt-6">
            <p className="px-4 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">Admin</p>
            <button onClick={() => onTabChange('admin-users')} className={navItemClass('admin-users')}>
              <Settings className="w-4 h-4 mr-3" />
              Users
            </button>
            <button onClick={() => onTabChange('settings')} className={navItemClass('settings')}>
              <Layers className="w-4 h-4 mr-3" />
              Settings
            </button>
          </div>
        )}
      </nav>

      <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
        <div className="flex items-center mb-3">
            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-600 dark:text-gray-300 mr-3">
                {currentUser?.firstName.charAt(0)}{currentUser?.lastName.charAt(0)}
            </div>
            <div className="overflow-hidden">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{currentUser?.firstName} {currentUser?.lastName}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{currentUser?.functionTitle}</p>
            </div>
        </div>
        <button 
            onClick={onLogout}
            className="flex items-center justify-center w-full px-4 py-2 text-xs font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/30 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
        >
          <LogOut className="w-3 h-3 mr-2" />
          Logout
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
