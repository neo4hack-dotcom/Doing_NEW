
import React, { useState } from 'react';
import { Team, User, Task, Project, TaskStatus, TaskPriority, ProjectStatus } from '../../types';
import { Briefcase, CheckCircle2, X } from 'lucide-react';

interface QuickCreateModalProps {
    isOpen: boolean;
    mode: 'project' | 'task';
    onClose: () => void;
    teams: Team[];
    users: User[];
    onUpdateTeam?: (team: Team) => void;
}

const QuickCreateModal: React.FC<QuickCreateModalProps> = ({ isOpen, mode, onClose, teams, users, onUpdateTeam }) => {
    const [quickTeamId, setQuickTeamId] = useState(teams[0]?.id || '');
    const [quickProjectId, setQuickProjectId] = useState('');
    const [newProjectName, setNewProjectName] = useState('');
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskAssignee, setNewTaskAssignee] = useState('');
    const [newTaskOrder, setNewTaskOrder] = useState(1);

    if (!isOpen) return null;

    const handleCreateProject = () => {
        if (!onUpdateTeam || !newProjectName) return;
        const team = teams.find(t => t.id === quickTeamId);
        if (!team) return;

        const newProject: Project = {
            id: Date.now().toString(),
            name: newProjectName,
            description: 'Created via Quick Action',
            status: ProjectStatus.PLANNING,
            managerId: team.managerId,
            deadline: new Date().toISOString().split('T')[0],
            members: [],
            tasks: [],
            isImportant: false,
            isArchived: false,
            docUrls: [],
            dependencies: [],
            externalDependencies: [],
            additionalDescriptions: [],
            cost: 0
        };

        onUpdateTeam({ ...team, projects: [...team.projects, newProject] });
        resetForm();
        alert(`Project "${newProjectName}" created in ${team.name}`);
    };

    const handleCreateTask = () => {
        if (!onUpdateTeam || !newTaskTitle || !quickProjectId) return;
        const team = teams.find(t => t.id === quickTeamId);
        if (!team) return;
        const project = team.projects.find(p => p.id === quickProjectId);
        if (!project) return;

        const newTask: Task = {
            id: Date.now().toString(),
            title: newTaskTitle,
            description: '',
            status: TaskStatus.TODO,
            priority: TaskPriority.MEDIUM,
            assigneeId: newTaskAssignee || undefined,
            eta: '',
            weight: 1,
            isImportant: false,
            checklist: [],
            order: newTaskOrder || project.tasks.length + 1
        };

        const updatedProjects = team.projects.map(p => {
            if (p.id === quickProjectId) {
                return { ...p, tasks: [...p.tasks, newTask] };
            }
            return p;
        });

        onUpdateTeam({ ...team, projects: updatedProjects });
        resetForm();
        alert(`Task assigned to ${users.find(u => u.id === newTaskAssignee)?.firstName || 'Unassigned'}`);
    };

    const resetForm = () => {
        setNewProjectName('');
        setNewTaskTitle('');
        setNewTaskAssignee('');
        setNewTaskOrder(1);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700 p-6 animate-in zoom-in-95 duration-150">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        {mode === 'project' ? <Briefcase className="w-5 h-5"/> : <CheckCircle2 className="w-5 h-5"/>}
                        {mode === 'project' ? 'New Project' : 'New Task'}
                    </h3>
                    <button onClick={onClose}><X className="w-5 h-5 text-slate-400"/></button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Select Team</label>
                        <select 
                           value={quickTeamId} 
                           onChange={e => { setQuickTeamId(e.target.value); setQuickProjectId(''); }}
                           className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                        >
                            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    </div>

                    {mode === 'project' && (
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Project Name</label>
                            <input 
                               type="text" 
                               value={newProjectName}
                               onChange={e => setNewProjectName(e.target.value)}
                               className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                               placeholder="e.g. Website Redesign"
                            />
                        </div>
                    )}

                    {mode === 'task' && (
                        <>
                           <div>
                               <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Select Project</label>
                               <select 
                                   value={quickProjectId} 
                                   onChange={e => setQuickProjectId(e.target.value)}
                                   className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                               >
                                   <option value="">-- Choose Project --</option>
                                   {teams.find(t => t.id === quickTeamId)?.projects.filter(p => !p.isArchived).map(p => (
                                       <option key={p.id} value={p.id}>{p.name}</option>
                                   ))}
                               </select>
                           </div>
                           <div className="flex gap-4">
                               <div className="flex-1">
                                   <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Task Title</label>
                                   <input 
                                       type="text" 
                                       value={newTaskTitle}
                                       onChange={e => setNewTaskTitle(e.target.value)}
                                       className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                       placeholder="e.g. Fix login bug"
                                   />
                               </div>
                               <div className="w-20">
                                   <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Order</label>
                                   <input 
                                       type="number" 
                                       value={newTaskOrder}
                                       onChange={e => setNewTaskOrder(parseInt(e.target.value))}
                                       className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                   />
                               </div>
                           </div>
                           <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Assign To</label>
                                <select 
                                   value={newTaskAssignee}
                                   onChange={e => setNewTaskAssignee(e.target.value)}
                                   className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                               >
                                   <option value="">-- Unassigned --</option>
                                   {users.map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
                               </select>
                           </div>
                        </>
                    )}

                    <button 
                       onClick={mode === 'project' ? handleCreateProject : handleCreateTask}
                       className="w-full py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors mt-4"
                    >
                        Create
                    </button>
                </div>
            </div>
        </div>
    );
};

export default QuickCreateModal;
