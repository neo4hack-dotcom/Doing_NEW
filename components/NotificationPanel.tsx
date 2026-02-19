
import React from 'react';
import { AppNotification, User, UserRole } from '../types';
import { Bell, BellOff, Briefcase, ClipboardList, AlertTriangle, Clock, Eye, CheckCircle2 } from 'lucide-react';

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  dynamicNotifications: AppNotification[];
  currentUser: User | null;
  onMarkSeen: (notificationId: string) => void;
  onMarkAllSeen: () => void;
}

const NotificationPanel: React.FC<NotificationPanelProps> = ({
  isOpen, onClose, notifications, dynamicNotifications, currentUser, onMarkSeen, onMarkAllSeen
}) => {
  if (!isOpen) return null;

  const isAdmin = currentUser?.role === UserRole.ADMIN;
  const userId = currentUser?.id || '';

  // Filter notifications relevant to current user
  const relevantNotifications = notifications.filter(n => {
    if (n.seenBy.includes(userId)) return false;
    if (n.targetRole === 'admin' && isAdmin) return true;
    if (n.targetRole === 'user' && n.targetUserId === userId) return true;
    return false;
  });

  // Dynamic notifications (stale project, report overdue) not yet dismissed
  const relevantDynamic = dynamicNotifications.filter(n => {
    if (n.seenBy.includes(userId)) return false;
    if (n.targetRole === 'user' && n.targetUserId === userId) return true;
    return false;
  });

  const allNotifications = [...relevantNotifications, ...relevantDynamic]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const getIcon = (type: string) => {
    switch (type) {
      case 'project_created':
      case 'project_updated':
        return <Briefcase className="w-4 h-4 text-indigo-500" />;
      case 'task_created':
      case 'task_updated':
        return <CheckCircle2 className="w-4 h-4 text-blue-500" />;
      case 'report_created':
      case 'report_updated':
        return <ClipboardList className="w-4 h-4 text-green-500" />;
      case 'stale_project':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'report_overdue':
        return <Clock className="w-4 h-4 text-red-500" />;
      default:
        return <Bell className="w-4 h-4 text-slate-400" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'project_created': return 'New Project';
      case 'project_updated': return 'Project Updated';
      case 'task_created': return 'New Task';
      case 'task_updated': return 'Task Updated';
      case 'report_created': return 'New Report';
      case 'report_updated': return 'Report Updated';
      case 'stale_project': return 'Stale Project';
      case 'report_overdue': return 'Report Overdue';
      default: return 'Notification';
    }
  };

  const getTypeBgColor = (type: string) => {
    switch (type) {
      case 'project_created':
      case 'project_updated':
        return 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800';
      case 'task_created':
      case 'task_updated':
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800';
      case 'report_created':
      case 'report_updated':
        return 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800';
      case 'stale_project':
        return 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800';
      case 'report_overdue':
        return 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800';
      default:
        return 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700';
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-0 top-full mt-2 w-[400px] max-h-[500px] bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-sm text-slate-800 dark:text-white">Notifications</h3>
            {allNotifications.length > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {allNotifications.length}
              </span>
            )}
          </div>
          {allNotifications.length > 0 && (
            <button
              onClick={onMarkAllSeen}
              className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
            >
              <Eye className="w-3 h-3" />
              Mark all as seen
            </button>
          )}
        </div>

        {/* Notification List */}
        <div className="overflow-y-auto flex-1">
          {allNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <BellOff className="w-10 h-10 mb-3 opacity-50" />
              <p className="text-sm font-medium">No new notifications</p>
            </div>
          ) : (
            <div className="p-2 space-y-1.5">
              {allNotifications.map(n => (
                <div key={n.id} className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${getTypeBgColor(n.type)}`}>
                  <div className="mt-0.5">{getIcon(n.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        {getTypeLabel(n.type)}
                      </span>
                      <span className="text-[10px] text-slate-400">{formatTime(n.createdAt)}</span>
                    </div>
                    <p className="text-sm text-slate-800 dark:text-slate-200 font-medium leading-snug">{n.message}</p>
                    {n.details && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">{n.details}</p>
                    )}
                  </div>
                  <button
                    onClick={() => onMarkSeen(n.id)}
                    className="shrink-0 text-xs text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 px-2 py-1 rounded-md transition-colors font-medium whitespace-nowrap"
                  >
                    Mark as seen
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default NotificationPanel;
