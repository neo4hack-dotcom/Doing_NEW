
import React from 'react';
import { Team, TaskStatus, SystemMessage, SmartTodo, OneOffQuery } from '../types';
import { CheckCircle2, Circle, Clock, AlertCircle, Megaphone, Info, AlertTriangle, ListTodo, Search } from 'lucide-react';

interface KPIDashboardProps {
  teams: Team[];
  systemMessage?: SystemMessage;
  smartTodos?: SmartTodo[];
  oneOffQueries?: OneOffQuery[];
}

const KPIDashboard: React.FC<KPIDashboardProps> = ({ teams, systemMessage, smartTodos = [], oneOffQueries = [] }) => {
  // --- Data Aggregation ---
  let totalTasks = 0;
  let totalClosed = 0;
  let totalBlocked = 0;
  let totalOngoing = 0;
  let totalTodo = 0;

  teams.forEach(t => {
    t.projects.forEach(p => {
      // Ignore archived projects for KPIs
      if (p.isArchived) return;

      p.tasks.forEach(task => {
        totalTasks++;
        if (task.status === TaskStatus.DONE) totalClosed++;
        if (task.status === TaskStatus.BLOCKED) totalBlocked++;
        if (task.status === TaskStatus.ONGOING) totalOngoing++;
        if (task.status === TaskStatus.TODO) totalTodo++;
      });
    });
  });

  const completionRate = totalTasks > 0 ? Math.round((totalClosed / totalTasks) * 100) : 0;

  // --- SmartTodo KPI Aggregation ---
  const activeTodos = smartTodos.filter(t => !t.isArchived && t.status !== 'cancelled');
  const todoInProgress = activeTodos.filter(t => t.status === 'in_progress').length;
  const todoBlocked = activeTodos.filter(t => t.status === 'blocked').length;
  const todoDone = activeTodos.filter(t => t.status === 'done').length;
  const todoPending = activeTodos.filter(t => t.status === 'todo').length;

  // --- OneOffQuery KPI Aggregation ---
  const activeQueries = oneOffQueries.filter(q => !q.archived && q.status !== 'cancelled');
  const queryPending = activeQueries.filter(q => q.status === 'pending').length;
  const queryInProgress = activeQueries.filter(q => q.status === 'in_progress').length;
  const queryDone = activeQueries.filter(q => q.status === 'done').length;

  // --- Components for Native Charts ---

  const StatCard = ({ title, value, subtext, colorClass, icon: Icon }: any) => (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
        <div className="flex justify-between items-start mb-4">
            <h3 className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">{title}</h3>
            {Icon && <Icon className={`w-5 h-5 ${colorClass} opacity-80`} />}
        </div>
        <div>
            <span className={`text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white`}>{value}</span>
            <p className="text-xs text-slate-400 mt-1">{subtext}</p>
        </div>
    </div>
  );

  // Simple Native Donut Chart using SVG
  const DonutChart = () => {
    const radius = 70;
    const circumference = 2 * Math.PI * radius;
    let accumulatedPercent = 0;

    const data = [
      { label: 'Done', value: totalClosed, color: 'text-emerald-500' },
      { label: 'In Progress', value: totalOngoing, color: 'text-blue-500' },
      { label: 'Blocked', value: totalBlocked, color: 'text-red-500' },
      { label: 'To Do', value: totalTodo, color: 'text-slate-300 dark:text-slate-600' }
    ].filter(d => d.value > 0);

    return (
      <div className="relative w-64 h-64 flex items-center justify-center">
        <svg className="w-full h-full transform -rotate-90">
          {data.map((item, index) => {
            const percent = item.value / totalTasks;
            const dashArray = `${percent * circumference} ${circumference}`;
            const dashOffset = -accumulatedPercent * circumference;
            accumulatedPercent += percent;

            return (
              <circle
                key={index}
                cx="50%"
                cy="50%"
                r={radius}
                fill="transparent"
                stroke="currentColor"
                strokeWidth="20"
                strokeDasharray={dashArray}
                strokeDashoffset={dashOffset}
                className={`${item.color} transition-all duration-1000 ease-out`}
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-4xl font-bold text-slate-900 dark:text-white">{totalTasks}</span>
          <span className="text-xs text-slate-500 uppercase font-semibold">Total Tasks</span>
        </div>
      </div>
    );
  };

  const getSystemMessageStyle = (level: string) => {
      switch(level) {
          case 'alert': return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200';
          case 'warning': return 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200';
          default: return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200';
      }
  };

  const getSystemMessageIcon = (level: string) => {
      switch(level) {
          case 'alert': return <AlertCircle className="w-5 h-5 shrink-0" />;
          case 'warning': return <AlertTriangle className="w-5 h-5 shrink-0" />;
          default: return <Info className="w-5 h-5 shrink-0" />;
      }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto animate-in fade-in">
      
      {/* SYSTEM BROADCAST MESSAGE */}
      {systemMessage?.active && systemMessage.content && (
          <div className={`p-4 rounded-xl border flex items-start gap-4 shadow-sm animate-in slide-in-from-top-4 ${getSystemMessageStyle(systemMessage.level)}`}>
              {getSystemMessageIcon(systemMessage.level)}
              <div className="flex-1">
                  <h4 className="font-bold text-sm uppercase tracking-wide mb-1 flex items-center">
                      <Megaphone className="w-4 h-4 mr-2" />
                      System Announcement
                  </h4>
                  <p className="text-sm font-medium whitespace-pre-wrap">{systemMessage.content}</p>
              </div>
          </div>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard 
            title="Completion Rate" 
            value={`${completionRate}%`} 
            icon={CheckCircle2}
            colorClass="text-emerald-500"
            subtext="Global completion"
        />
        <StatCard 
            title="Active Work" 
            value={totalOngoing} 
            icon={Circle}
            colorClass="text-blue-500"
            subtext="Tasks in progress"
        />
        <StatCard 
            title="Bottlenecks" 
            value={totalBlocked} 
            icon={AlertCircle}
            colorClass="text-red-500"
            subtext="Blocked tasks"
        />
        <StatCard 
            title="Total Scope" 
            value={totalTasks} 
            icon={Clock}
            colorClass="text-slate-400"
            subtext="Total tasks recorded"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Native Stacked Bar Chart for Team Workload */}
        <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 lg:col-span-2">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Team Workload Distribution</h3>
            <div className="space-y-6">
                {teams.map(team => {
                    let tDone = 0, tProg = 0, tBlock = 0, tTodo = 0;
                    
                    // Filter archived projects before aggregation
                    const activeProjects = team.projects.filter(p => !p.isArchived);
                    
                    if (activeProjects.length === 0) return null; // Or show empty state for team if needed

                    activeProjects.forEach(p => {
                        p.tasks.forEach(t => {
                            if(t.status === TaskStatus.DONE) tDone++;
                            else if(t.status === TaskStatus.ONGOING) tProg++;
                            else if(t.status === TaskStatus.BLOCKED) tBlock++;
                            else tTodo++;
                        });
                    });
                    const tTotal = tDone + tProg + tBlock + tTodo;
                    if (tTotal === 0) return null;

                    return (
                        <div key={team.id}>
                            <div className="flex justify-between text-sm mb-2">
                                <span className="font-semibold text-slate-700 dark:text-slate-200">{team.name}</span>
                                <span className="text-slate-500">{tTotal} tasks</span>
                            </div>
                            <div className="h-4 w-full bg-slate-100 dark:bg-slate-700 rounded-full flex overflow-hidden">
                                {tDone > 0 && <div style={{width: `${(tDone/tTotal)*100}%`}} className="bg-emerald-500 h-full" title={`Done: ${tDone}`}></div>}
                                {tProg > 0 && <div style={{width: `${(tProg/tTotal)*100}%`}} className="bg-blue-500 h-full" title={`In Progress: ${tProg}`}></div>}
                                {tBlock > 0 && <div style={{width: `${(tBlock/tTotal)*100}%`}} className="bg-red-500 h-full" title={`Blocked: ${tBlock}`}></div>}
                                {tTodo > 0 && <div style={{width: `${(tTodo/tTotal)*100}%`}} className="bg-slate-300 dark:bg-slate-600 h-full" title={`Todo: ${tTodo}`}></div>}
                            </div>
                        </div>
                    );
                })}
                {teams.length === 0 && <p className="text-slate-400 italic">No teams defined.</p>}
            </div>
            
            {/* Legend */}
            <div className="flex flex-wrap gap-4 mt-8 justify-center">
                <div className="flex items-center text-xs text-slate-600 dark:text-slate-300"><span className="w-3 h-3 bg-emerald-500 rounded-full mr-2"></span>Done</div>
                <div className="flex items-center text-xs text-slate-600 dark:text-slate-300"><span className="w-3 h-3 bg-blue-500 rounded-full mr-2"></span>In Progress</div>
                <div className="flex items-center text-xs text-slate-600 dark:text-slate-300"><span className="w-3 h-3 bg-red-500 rounded-full mr-2"></span>Blocked</div>
                <div className="flex items-center text-xs text-slate-600 dark:text-slate-300"><span className="w-3 h-3 bg-slate-300 dark:bg-slate-600 rounded-full mr-2"></span>To Do</div>
            </div>
        </div>

        {/* Native Donut Chart */}
        <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 self-start">Global Health</h3>
            
            {totalTasks > 0 ? <DonutChart /> : (
                <div className="h-64 w-full flex items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-full">
                    No Data (Active Projects)
                </div>
            )}

             <div className="w-full space-y-3 mt-8">
                 <div className="flex justify-between items-center text-sm border-b border-slate-100 dark:border-slate-700 pb-2">
                     <div className="flex items-center"><div className="w-3 h-3 rounded-full mr-2 bg-emerald-500"></div>Done</div>
                     <span className="font-bold text-slate-700 dark:text-white">{totalClosed}</span>
                 </div>
                 <div className="flex justify-between items-center text-sm border-b border-slate-100 dark:border-slate-700 pb-2">
                     <div className="flex items-center"><div className="w-3 h-3 rounded-full mr-2 bg-blue-500"></div>In Progress</div>
                     <span className="font-bold text-slate-700 dark:text-white">{totalOngoing}</span>
                 </div>
                 <div className="flex justify-between items-center text-sm border-b border-slate-100 dark:border-slate-700 pb-2">
                     <div className="flex items-center"><div className="w-3 h-3 rounded-full mr-2 bg-red-500"></div>Blocked</div>
                     <span className="font-bold text-slate-700 dark:text-white">{totalBlocked}</span>
                 </div>
             </div>
        </div>
      </div>

      {/* SMART TODO KPIs */}
      <div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <ListTodo className="w-5 h-5 text-indigo-500" />
          My To-Do List
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Total Active</p>
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">{activeTodos.length}</span>
            <p className="text-xs text-slate-400 mt-1">Non-archived tasks</p>
          </div>
          <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-blue-200 dark:border-blue-900/40 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-blue-500 mb-2">In Progress</p>
            <span className="text-3xl font-extrabold text-blue-600 dark:text-blue-400">{todoInProgress}</span>
            <p className="text-xs text-slate-400 mt-1">Currently working on</p>
          </div>
          <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-red-200 dark:border-red-900/40 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-red-500 mb-2">Blocked</p>
            <span className="text-3xl font-extrabold text-red-600 dark:text-red-400">{todoBlocked}</span>
            <p className="text-xs text-slate-400 mt-1">Waiting / blocked</p>
          </div>
          <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-emerald-200 dark:border-emerald-900/40 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-500 mb-2">Done</p>
            <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">{todoDone}</span>
            <p className="text-xs text-slate-400 mt-1">Completed tasks</p>
          </div>
        </div>
        {activeTodos.length > 0 && (
          <div className="mt-3 h-2.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full flex overflow-hidden">
            {todoDone > 0 && <div style={{width: `${(todoDone / activeTodos.length) * 100}%`}} className="bg-emerald-500 h-full" title={`Done: ${todoDone}`} />}
            {todoInProgress > 0 && <div style={{width: `${(todoInProgress / activeTodos.length) * 100}%`}} className="bg-blue-500 h-full" title={`In Progress: ${todoInProgress}`} />}
            {todoBlocked > 0 && <div style={{width: `${(todoBlocked / activeTodos.length) * 100}%`}} className="bg-red-500 h-full" title={`Blocked: ${todoBlocked}`} />}
            {todoPending > 0 && <div style={{width: `${(todoPending / activeTodos.length) * 100}%`}} className="bg-slate-300 dark:bg-slate-600 h-full" title={`To Do: ${todoPending}`} />}
          </div>
        )}
      </div>

      {/* ONE-OFF QUERY KPIs */}
      <div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Search className="w-5 h-5 text-violet-500" />
          My One-Off Queries
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Total Active</p>
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">{activeQueries.length}</span>
            <p className="text-xs text-slate-400 mt-1">Non-archived queries</p>
          </div>
          <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-amber-200 dark:border-amber-900/40 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-500 mb-2">Pending</p>
            <span className="text-3xl font-extrabold text-amber-600 dark:text-amber-400">{queryPending}</span>
            <p className="text-xs text-slate-400 mt-1">Awaiting treatment</p>
          </div>
          <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-blue-200 dark:border-blue-900/40 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-blue-500 mb-2">In Progress</p>
            <span className="text-3xl font-extrabold text-blue-600 dark:text-blue-400">{queryInProgress}</span>
            <p className="text-xs text-slate-400 mt-1">Currently being handled</p>
          </div>
          <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-emerald-200 dark:border-emerald-900/40 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-500 mb-2">Done</p>
            <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">{queryDone}</span>
            <p className="text-xs text-slate-400 mt-1">Delivered queries</p>
          </div>
        </div>
        {activeQueries.length > 0 && (
          <div className="mt-3 h-2.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full flex overflow-hidden">
            {queryDone > 0 && <div style={{width: `${(queryDone / activeQueries.length) * 100}%`}} className="bg-emerald-500 h-full" title={`Done: ${queryDone}`} />}
            {queryInProgress > 0 && <div style={{width: `${(queryInProgress / activeQueries.length) * 100}%`}} className="bg-blue-500 h-full" title={`In Progress: ${queryInProgress}`} />}
            {queryPending > 0 && <div style={{width: `${(queryPending / activeQueries.length) * 100}%`}} className="bg-amber-400 h-full" title={`Pending: ${queryPending}`} />}
          </div>
        )}
      </div>
    </div>
  );
};

export default KPIDashboard;
