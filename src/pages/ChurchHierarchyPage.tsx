'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { apiFetch } from '@/lib/api';


type HierarchyLevel = 'state' | 'region' | 'group' | 'district' | 'location';

interface HierarchyItem {
  id: string;
  name: string;
  isActive: boolean;
  stateId?: string;
  regionId?: string;
  groupId?: string;
  districtId?: string;
}

interface HierarchyData {
  states: HierarchyItem[];
  regions: HierarchyItem[];
  groups: HierarchyItem[];
  districts: HierarchyItem[];
  locations: HierarchyItem[];
}

const TABS: { key: HierarchyLevel; label: string }[] = [
  { key: 'state', label: 'States' },
  { key: 'region', label: 'Regions' },
  { key: 'group', label: 'Groups' },
  { key: 'district', label: 'Districts' },
  { key: 'location', label: 'Locations' },
];

export default function ChurchHierarchyPage() {
  const user = useAppStore((s) => s.user);
  const isSuperAdmin = user?.scope?.level === 'global';
  
  // What specific level is this lower admin allowed to create?
  const LEVEL_TO_CREATE_MAP: Record<string, HierarchyLevel | null> = {
    global: null,
    state: 'region',
    region: 'group',
    group: 'district',
    district: 'location',
    location: null,
  };

  const allowedLevel = user?.scope?.level ? LEVEL_TO_CREATE_MAP[user.scope.level] : null;

  // Super Admin starts on States. Lower admins are forced to their specific level.
  const [activeTab, setActiveTab] = useState<HierarchyLevel>(isSuperAdmin ? 'state' : (allowedLevel || 'state'));
  const [data, setData] = useState<HierarchyData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [selectedParent, setSelectedParent] = useState('');
  const [newName, setNewName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchHierarchy = async () => {
    try {
      setIsLoading(true);
      const result = await apiFetch<HierarchyData>('/api/hierarchy');
      setData(result);
      
      // Auto-lock parent for lower admins
           // Auto-lock parent for lower admins
      if (!isSuperAdmin && allowedLevel && user?.scope) {
    
    let lockedParentId = '';

   if (allowedLevel === 'region') lockedParentId = user.scope.stateId ?? '';
        else if (allowedLevel === 'group') lockedParentId = user.scope.regionId ?? '';
        else if (allowedLevel === 'district') lockedParentId = user.scope.groupId ?? '';
        else if (allowedLevel === 'location') lockedParentId = user.scope.districtId ?? '';

        setSelectedParent(lockedParentId);
      }
    } catch (error) {
      console.error('Failed to fetch hierarchy', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchHierarchy(); }, []);

   const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    try {
      setIsCreating(true);
      
      let finalParentId: string | undefined = undefined;

      if (isSuperAdmin) {
        finalParentId = activeTab !== 'state' ? selectedParent : undefined;
      } else if (user?.scope) {
        // ✅ ENTERPRISE FIX: Resolve parent ID purely from injected scope level
          if (allowedLevel === 'region') finalParentId = user.scope.stateId ?? undefined;
        else if (allowedLevel === 'group') finalParentId = user.scope.regionId ?? undefined;
        else if (allowedLevel === 'district') finalParentId = user.scope.groupId ?? undefined;
        else if (allowedLevel === 'location') finalParentId = user.scope.districtId ?? undefined;
      }

      await apiFetch('/api/hierarchy', {
        method: 'POST',
        body: JSON.stringify({
          level: isSuperAdmin ? activeTab : allowedLevel,
          name: newName.trim(),
          parentId: finalParentId,
        }),
      });
      setNewName('');
      fetchHierarchy();
    } catch (error: any) {
      alert(error.message || 'Failed to create');
    } finally {
      setIsCreating(false);
    }
  };
  
  const handleEditClick = (item: HierarchyItem) => {
    setEditingId(item.id);
    setEditName(item.name);
  };

  const handleSaveEdit = async (id: string) => {
    if (!editName.trim()) return;
    try {
      setIsUpdating(true);
      await apiFetch('/api/hierarchy', {
        method: 'PUT',
        body: JSON.stringify({ id, level: isSuperAdmin ? activeTab : allowedLevel, name: editName.trim() }),
      });
      setEditingId(null);
      fetchHierarchy();
    } catch (error: any) {
      alert(error.message || 'Failed to update');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const confirmMsg = `Are you sure you want to delete "${name}"?\n\nWARNING: This will delete ALL children under it. This cannot be undone.`;
    if (!confirm(confirmMsg)) return;

    try {
      await apiFetch('/api/hierarchy', {
        method: 'DELETE',
        body: JSON.stringify({ id, level: isSuperAdmin ? activeTab : allowedLevel }),
      });
      if (selectedParent === id) setSelectedParent('');
      fetchHierarchy();
    } catch (error: any) {
      alert(error.message || 'Failed to delete');
    }
  };

  const getParentOptions = () => {
    if (!data) return [];
    switch (isSuperAdmin ? activeTab : allowedLevel) {
      case 'region': return data.states;
      case 'group': return data.regions;
      case 'district': return data.groups;
      case 'location': return data.districts;
      default: return [];
    }
  };

  const getCurrentItems = () => {
    if (!data) return [];
    const currentLevel = isSuperAdmin ? activeTab : (allowedLevel || 'state');
    switch (currentLevel) {
      case 'state': return data.states;
      case 'region': return data.regions.filter(r => r.stateId === selectedParent);
      case 'group': return data.groups.filter(g => g.regionId === selectedParent);
      case 'district': return data.districts.filter(d => d.groupId === selectedParent);
      case 'location': return data.locations.filter(l => l.districtId === selectedParent);
      default: return [];
    }
  };

  const levelLabels: Record<string, string> = {
    state: 'State', region: 'Region', group: 'Group', district: 'District', location: 'Location'
  };

  if (isLoading) return <div className="p-6 text-gray-500">Loading hierarchy...</div>;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Church Hierarchy</h1>
        <p className="text-gray-500 mt-1">
          {isSuperAdmin 
            ? 'Create and manage the entire structural tree.' 
            : `Create and manage ${levelLabels[allowedLevel || '']}s under your assigned scope.`
          }
        </p>
      </div>

      {/* TABS: ONLY SHOW TO SUPER ADMIN */}
      {isSuperAdmin && (
        <div className="flex flex-wrap border-b border-gray-200 gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setSelectedParent(''); setEditingId(null); }}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key ? 'border-green-600 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Action Area */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
        <h3 className="font-semibold mb-4">
          {isSuperAdmin ? `Add New ${levelLabels[activeTab]}` : `Add New ${levelLabels[allowedLevel || '']}`}
        </h3>
        
        <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-3">
          {/* Parent Dropdown Logic */}
          {isSuperAdmin ? (
            activeTab !== 'state' && (
              <select required value={selectedParent} onChange={(e) => setSelectedParent(e.target.value)} className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 outline-none">
                <option value="">Select Parent...</option>
                {getParentOptions().map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
              </select>
            )
          ) : (
                        allowedLevel && allowedLevel !== 'state' && (
              <select required value={selectedParent} disabled={true} className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm bg-gray-100 text-gray-600 cursor-not-allowed">
                <option value="">
                  {/* ✅ PRODUCTION FIX: Explicitly show the correct parent name for the level being created */}
                  {allowedLevel === 'region' && (user?.scopeNames?.stateName || 'Your Assigned State')}
                  {allowedLevel === 'group' && (user?.scopeNames?.regionName || 'Your Assigned Region')}
                  {allowedLevel === 'district' && (user?.scopeNames?.groupName || 'Your Assigned Group')}
                  {allowedLevel === 'location' && (user?.scopeNames?.districtName || 'Your Assigned District')}
                  {!['region', 'group', 'district', 'location'].includes(allowedLevel || '') && 'Your Assigned Scope'}
                </option>
              </select>
            )
          )}

          <input
            type="text"
            required
            placeholder={`Enter ${isSuperAdmin ? levelLabels[activeTab] : levelLabels[allowedLevel || '']} name`}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 outline-none"
          />

          <button type="submit" disabled={isCreating} className="bg-green-600 text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-green-700 disabled:bg-gray-400 transition-colors">
            {isCreating ? 'Saving...' : 'Add'}
          </button>
        </form>
      </div>

      {/* List Area */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
          <h3 className="font-semibold text-gray-700">
            {isSuperAdmin 
              ? (activeTab === 'state' ? 'All States' : `${levelLabels[activeTab]}s under ${getParentOptions().find(p => p.id === selectedParent)?.name || '...'}`)
              : `${levelLabels[allowedLevel || '']}s under ${getParentOptions().find(p => p.id === selectedParent)?.name || '...'}`
            }
          </h3>
        </div>
        
        {(isSuperAdmin ? activeTab !== 'state' : allowedLevel !== 'state') && !selectedParent ? (
          <p className="p-6 text-center text-gray-400 text-sm">Please select a parent from the dropdown above to view items.</p>
        ) : getCurrentItems().length === 0 ? (
          <p className="p-6 text-center text-gray-400 text-sm">No items found. Add the first one above!</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {getCurrentItems().map((item) => (
              <li key={item.id} className="flex justify-between items-center px-4 py-3 hover:bg-gray-50">
                <div className="flex-1 mr-4">
                  {editingId === item.id ? (
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full border border-green-400 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-green-500 outline-none"
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit(item.id)}
                    />
                  ) : (
                    <>
                      <p className="font-medium text-gray-800">{item.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">ID: {item.id.slice(0, 8)}...</p>
                    </>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full hidden sm:inline-block ${item.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {item.isActive ? 'Active' : 'Inactive'}
                  </span>

                  {editingId === item.id ? (
                    <div className="flex gap-1">
                      <button onClick={() => handleSaveEdit(item.id)} disabled={isUpdating} className="text-green-600 hover:text-green-800 font-medium text-sm px-2">
                        {isUpdating ? '...' : 'Save'}
                      </button>
                      <button onClick={() => setEditingId(null)} className="text-gray-500 hover:text-gray-700 font-medium text-sm px-2">
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-1">
                      <button onClick={() => handleEditClick(item)} className="text-blue-600 hover:text-blue-800 font-medium text-sm px-2">
                        Edit
                      </button>
                      <button onClick={() => handleDelete(item.id, item.name)} className="text-red-600 hover:text-red-800 font-medium text-sm px-2">
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}