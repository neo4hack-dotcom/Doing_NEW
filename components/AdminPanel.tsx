
import React, { useState } from 'react';
import { User, UserRole, Team } from '../types';
import { Plus, Trash2, User as UserIcon, Shield, ChevronDown, ChevronRight, Users, Briefcase, Pencil, Save, X, MapPin, Key } from 'lucide-react';

interface AdminPanelProps {
  users: User[];
  teams: Team[];
  onAddUser: (user: User) => void;
  onUpdateUser: (user: User) => void;
  onDeleteUser: (userId: string) => void;
  onAddTeam: (team: Team) => void;
  onUpdateTeam: (team: Team) => void;
  onDeleteTeam: (teamId: string) => void;
}

const HierarchyNode: React.FC<{ user: User; allUsers: User[]; level?: number }> = ({ user, allUsers, level = 0 }) => {
  const [expanded, setExpanded] = useState(true);
  const reports = allUsers.filter(u => u.managerId === user.id);
  const hasReports = reports.length > 0;

  return (
    <div className={`mb-2`}>
      <div 
        className={`flex items-center p-3 rounded-lg border transition-all 
            ${level === 0 
                ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800' 
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'} 
        `}
        style={{ marginLeft: `${level * 2}rem` }}
      >
        <button 
            onClick={() => setExpanded(!expanded)}
            className={`mr-2 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors ${hasReports ? 'text-slate-500 dark:text-slate-400' : 'text-slate-300 dark:text-slate-700 cursor-default'}`}
            disabled={!hasReports}
        >
             {hasReports ? (expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />) : <div className="w-4" />}
        </button>

        <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 text-xs font-bold mr-3 border border-slate-300 dark:border-slate-600">
            {user.firstName[0]}{user.lastName[0]}
        </div>
        
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{user.firstName} {user.lastName}</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400">{user.functionTitle} <span className="text-slate-300 dark:text-slate-600 px-1">|</span> <span className="text-indigo-600 dark:text-indigo-400 font-mono">{user.uid}</span></p>
        </div>

        <div className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide rounded-full border
            ${user.role === UserRole.ADMIN ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800' : 
              user.role === UserRole.MANAGER ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800' :
              'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600'}
        `}>
          {user.role}
        </div>
      </div>
      
      {expanded && hasReports && (
        <div className="mt-2 relative">
             <div className="absolute left-6 top-0 bottom-0 w-px bg-slate-200 dark:bg-slate-700" style={{ left: `${(level * 32) + 22}px`}}></div>
            {reports.map(report => (
                <HierarchyNode key={report.id} user={report} allUsers={allUsers} level={level + 1} />
            ))}
        </div>
      )}
    </div>
  );
};

const AdminPanel: React.FC<AdminPanelProps> = ({ users, teams, onAddUser, onUpdateUser, onDeleteUser, onAddTeam, onUpdateTeam, onDeleteTeam }) => {
  const [activeTab, setActiveTab] = useState<'users' | 'teams'>('users');
  
  // User Management State
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userForm, setUserForm] = useState<Partial<User>>({
    role: UserRole.EMPLOYEE,
    managerId: '',
    location: '',
    password: ''
  });

  // Team Management State
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [teamForm, setTeamForm] = useState<{name: string, managerId: string}>({
      name: '',
      managerId: ''
  });

  const handleSaveUser = () => {
    if (userForm.firstName && userForm.lastName && userForm.uid && userForm.functionTitle) {
      if (editingUserId) {
          // Update
          const existingUser = users.find(u => u.id === editingUserId);
          if (existingUser) {
              onUpdateUser({
                  ...existingUser,
                  ...userForm as User,
                  managerId: userForm.managerId || null,
                  location: userForm.location,
                  password: userForm.password || existingUser.password // Keep existing if empty, or update
              });
          }
          setEditingUserId(null);
      } else {
          // Create
          // Check for Duplicate UID
          if (users.some(u => u.uid.toLowerCase() === userForm.uid?.toLowerCase())) {
              alert(`Error: User ID "${userForm.uid}" already exists. Please choose a different one.`);
              return;
          }

          onAddUser({
            id: Date.now().toString(),
            firstName: userForm.firstName!,
            lastName: userForm.lastName!,
            uid: userForm.uid!,
            functionTitle: userForm.functionTitle!,
            role: userForm.role as UserRole,
            managerId: userForm.managerId || null,
            password: userForm.password || '1234', // Use provided password or default
            location: userForm.location
          });
      }
      // Reset
      setUserForm({ role: UserRole.EMPLOYEE, managerId: '', location: '', password: '' });
    } else {
        alert("Please fill all required fields.");
    }
  };

  const handleEditClick = (user: User) => {
      setEditingUserId(user.id);
      setUserForm({
          firstName: user.firstName,
          lastName: user.lastName,
          uid: user.uid,
          functionTitle: user.functionTitle,
          role: user.role,
          managerId: user.managerId || '',
          location: user.location || '',
          password: user.password || ''
      });
  };

  const handleCancelEdit = () => {
      setEditingUserId(null);
      setUserForm({ role: UserRole.EMPLOYEE, managerId: '', location: '', password: '' });
  };

  // --- Team Logic ---

  const handleSaveTeam = () => {
      if (teamForm.name && teamForm.managerId) {
          if (editingTeamId) {
              // Edit existing
              const existingTeam = teams.find(t => t.id === editingTeamId);
              if (existingTeam) {
                  onUpdateTeam({
                      ...existingTeam,
                      name: teamForm.name,
                      managerId: teamForm.managerId
                  });
              }
              setEditingTeamId(null);
          } else {
              // Create new
              onAddTeam({
                  id: Date.now().toString(),
                  name: teamForm.name,
                  managerId: teamForm.managerId,
                  projects: []
              });
          }
          setTeamForm({ name: '', managerId: '' });
      }
  };

  const handleEditTeamClick = (team: Team) => {
      setEditingTeamId(team.id);
      setTeamForm({
          name: team.name,
          managerId: team.managerId
      });
      // Scroll to top to see form
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelTeamEdit = () => {
      setEditingTeamId(null);
      setTeamForm({ name: '', managerId: '' });
  };

  const rootUsers = users.filter(u => !u.managerId);
  const potentialManagers = users.filter(u => u.role === UserRole.MANAGER || u.role === UserRole.ADMIN);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      
      {/* Tabs */}
      <div className="flex space-x-4 border-b border-slate-200 dark:border-slate-700">
          <button 
            onClick={() => setActiveTab('users')}
            className={`pb-4 px-2 font-medium text-sm transition-colors border-b-2 ${activeTab === 'users' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
              User Management
          </button>
          <button 
            onClick={() => setActiveTab('teams')}
            className={`pb-4 px-2 font-medium text-sm transition-colors border-b-2 ${activeTab === 'teams' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
              Team Management
          </button>
      </div>

      {activeTab === 'users' && (
        <div className="space-y-8 animate-in fade-in">
            {/* Creation/Edit Card */}
            <div className={`p-8 rounded-2xl shadow-sm border transition-colors ${editingUserId ? 'bg-indigo-50/50 dark:bg-indigo-900/10 border-indigo-200 dark:border-indigo-800' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center justify-between">
                    <div className="flex items-center">
                        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg mr-3">
                            <UserIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        {editingUserId ? 'Edit User' : 'Create New User'}
                    </div>
                    {editingUserId && (
                        <button onClick={handleCancelEdit} className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 flex items-center">
                            <X className="w-4 h-4 mr-1" /> Cancel
                        </button>
                    )}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                <input
                    className="col-span-1 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white"
                    placeholder="First Name"
                    value={userForm.firstName || ''}
                    onChange={e => setUserForm({ ...userForm, firstName: e.target.value })}
                />
                <input
                    className="col-span-1 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white"
                    placeholder="Last Name"
                    value={userForm.lastName || ''}
                    onChange={e => setUserForm({ ...userForm, lastName: e.target.value })}
                />
                <input
                    className="col-span-1 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white"
                    placeholder="UID (e.g. EMP001)"
                    value={userForm.uid || ''}
                    onChange={e => setUserForm({ ...userForm, uid: e.target.value })}
                />
                 {/* Password Field */}
                 <div className="col-span-1 relative">
                    <input
                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white pl-8"
                        placeholder="Password"
                        type="text"
                        value={userForm.password || ''}
                        onChange={e => setUserForm({ ...userForm, password: e.target.value })}
                    />
                    <Key className="w-4 h-4 text-slate-400 absolute left-2.5 top-3" />
                </div>

                <input
                    className="col-span-1 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white"
                    placeholder="Job Title"
                    value={userForm.functionTitle || ''}
                    onChange={e => setUserForm({ ...userForm, functionTitle: e.target.value })}
                />
                <input
                    className="col-span-1 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white"
                    placeholder="Location (City/Country)"
                    value={userForm.location || ''}
                    onChange={e => setUserForm({ ...userForm, location: e.target.value })}
                />
                
                <div className="col-span-full mt-2 grid grid-cols-6 gap-4 items-end">
                    <div className="col-span-2">
                         <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Role</label>
                         <select
                            className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white"
                            value={userForm.role}
                            onChange={e => setUserForm({ ...userForm, role: e.target.value as UserRole })}
                        >
                            {Object.values(UserRole).map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>
                    <div className="col-span-3">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Reports To (Manager)</label>
                        <select
                            className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white"
                            value={userForm.managerId || ''}
                            onChange={e => setUserForm({...userForm, managerId: e.target.value})}
                        >
                            <option value="">-- No Manager (Root) --</option>
                            {users.filter(u => u.id !== editingUserId).map(u => (
                                <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.role})</option>
                            ))}
                        </select>
                    </div>
                    <button
                        onClick={handleSaveUser}
                        className="col-span-1 bg-indigo-600 hover:bg-indigo-700 text-white p-2.5 rounded-lg font-medium transition-colors flex items-center justify-center shadow-md h-[42px]"
                    >
                        {editingUserId ? <Save className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                        {editingUserId ? 'Save' : 'Add'}
                    </button>
                </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Hierarchy View */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center">
                        <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg mr-3">
                            <Shield className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        Organizational Chart
                    </h2>
                    <div className="overflow-x-auto">
                        {rootUsers.map(rootUser => (
                            <HierarchyNode key={rootUser.id} user={rootUser} allUsers={users} />
                        ))}
                    </div>
                </div>
                
                {/* Quick List */}
                <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Directory</h2>
                    <div className="overflow-y-auto max-h-[500px] pr-2">
                        <div className="space-y-3">
                            {users.map(u => (
                                <div key={u.id} className={`flex items-center justify-between p-3 rounded-lg border hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${editingUserId === u.id ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-slate-100 dark:border-slate-700/50'}`}>
                                    <div className="flex items-center overflow-hidden">
                                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-500 dark:text-slate-400 mr-3 flex-shrink-0">
                                            {u.firstName[0]}{u.lastName[0]}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-sm font-medium text-slate-900 dark:text-white truncate">{u.firstName} {u.lastName}</div>
                                            <div className="flex gap-2">
                                                <span className="text-xs text-slate-500 dark:text-slate-400 truncate">{u.uid}</span>
                                                {u.location && <span className="text-xs text-slate-400 flex items-center truncate"><MapPin className="w-3 h-3 mr-0.5" />{u.location}</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button 
                                            onClick={() => handleEditClick(u)} 
                                            className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                                            title="Edit"
                                        >
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                        <button 
                                            onClick={() => onDeleteUser(u.id)} 
                                            className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                                            title="Delete"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}

      {activeTab === 'teams' && (
          <div className="space-y-8 animate-in fade-in">
              {/* Team Creation / Edit */}
              <div className={`bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors ${editingTeamId ? 'bg-indigo-50/50 dark:bg-indigo-900/10 border-indigo-200 dark:border-indigo-800' : ''}`}>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center justify-between">
                    <div className="flex items-center">
                        <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg mr-3">
                            <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        {editingTeamId ? 'Edit Team' : 'Create New Team'}
                    </div>
                    {editingTeamId && (
                        <button onClick={handleCancelTeamEdit} className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 flex items-center">
                            <X className="w-4 h-4 mr-1" /> Cancel
                        </button>
                    )}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Team Name</label>
                        <input
                            className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white"
                            placeholder="Engineering Alpha"
                            value={teamForm.name}
                            onChange={e => setTeamForm({ ...teamForm, name: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Team Manager</label>
                        <select
                            className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white"
                            value={teamForm.managerId}
                            onChange={e => setTeamForm({ ...teamForm, managerId: e.target.value })}
                        >
                            <option value="">-- Select Manager --</option>
                            {potentialManagers.map(u => (
                                <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.role})</option>
                            ))}
                        </select>
                    </div>
                    <button
                        onClick={handleSaveTeam}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white p-2.5 rounded-lg font-medium transition-colors flex items-center justify-center shadow-md md:col-span-2 mt-2"
                    >
                        {editingTeamId ? <Save className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                        {editingTeamId ? 'Save Changes' : 'Create Team'}
                    </button>
                </div>
              </div>

              {/* Teams List */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {teams.map(team => {
                      const manager = users.find(u => u.id === team.managerId);
                      const isEditing = editingTeamId === team.id;
                      return (
                          <div key={team.id} className={`bg-white dark:bg-slate-800 p-6 rounded-xl border shadow-sm relative group transition-all ${isEditing ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-slate-200 dark:border-slate-700'}`}>
                              <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button 
                                    onClick={() => handleEditTeamClick(team)}
                                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                                    title="Edit Team"
                                  >
                                      <Pencil className="w-4 h-4" />
                                  </button>
                                  <button 
                                    onClick={() => onDeleteTeam(team.id)}
                                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                                    title="Delete Team"
                                  >
                                      <Trash2 className="w-4 h-4" />
                                  </button>
                              </div>
                              <div className="flex items-center gap-3 mb-4">
                                  <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                      <Briefcase className="w-5 h-5" />
                                  </div>
                                  <div>
                                      <h3 className="font-bold text-slate-900 dark:text-white">{team.name}</h3>
                                      <p className="text-xs text-slate-500 dark:text-slate-400">{team.projects.length} Projects</p>
                                  </div>
                              </div>
                              <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                                  <p className="text-xs text-slate-400 uppercase font-semibold mb-1">Managed By</p>
                                  <div className="flex items-center">
                                        {manager ? (
                                            <>
                                                <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-xs font-bold text-indigo-700 dark:text-indigo-300 mr-2">
                                                    {manager.firstName[0]}{manager.lastName[0]}
                                                </div>
                                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{manager.firstName} {manager.lastName}</span>
                                            </>
                                        ) : (
                                            <span className="text-sm text-red-500 italic">No Manager Assigned</span>
                                        )}
                                  </div>
                              </div>
                          </div>
                      )
                  })}
              </div>
          </div>
      )}

    </div>
  );
};

export default AdminPanel;
