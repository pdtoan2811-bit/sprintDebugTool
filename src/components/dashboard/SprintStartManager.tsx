'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { RawLogEvent, WORKFLOW_STATUSES } from '@/lib/types';
import { SprintStartEntry } from '@/lib/hooks/useSprintStart';
import { Badge } from '../ui/badge';
import { format } from 'date-fns';
import {
    ArrowUpDown,
    Check,
    CheckSquare,
    ChevronDown,
    Clock,
    Edit3,
    ExternalLink,
    Filter,
    Flag,
    RotateCcw,
    Save,
    Search,
    Square,
    User,
    CloudSync,
} from 'lucide-react';
import { useSprintStartSync } from '@/lib/hooks/useSprintStartSync';
import { SprintStartSyncModal } from './SprintStartSyncModal';

interface SprintStartManagerProps {
    rawLogs: RawLogEvent[];
    selectedSprint: string;
    getSprintStartSnapshot: (sprint: string, logs: RawLogEvent[]) => SprintStartEntry[];
    onSaveOverride: (sprint: string, taskId: string, newStatus: string) => void;
    onBulkSaveOverrides: (sprint: string, entries: { taskId: string; status: string }[]) => void;
    onClearOverride: (sprint: string, taskId: string) => void;
    onClearAllOverrides: (sprint: string) => void;
    onConfirmAll: (sprint: string, entries: SprintStartEntry[]) => void;
}

type SortKey = 'taskId' | 'taskName' | 'person' | 'module' | 'autoDetectedStatus' | 'confirmedStatus';

const STATUS_OPTIONS = WORKFLOW_STATUSES.map(s => s.name);

export function SprintStartManager({
    rawLogs,
    selectedSprint,
    getSprintStartSnapshot,
    onSaveOverride,
    onBulkSaveOverrides,
    onClearOverride,
    onClearAllOverrides,
    onConfirmAll,
}: SprintStartManagerProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
    const [sortKey, setSortKey] = useState<SortKey>('taskId');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
    const [showBulkMenu, setShowBulkMenu] = useState(false);
    const [localEntries, setLocalEntries] = useState<SprintStartEntry[]>([]);
    const [showSyncModal, setShowSyncModal] = useState(false);

    const { 
        isSyncing, 
        current, 
        total, 
        logs, 
        syncToLark, 
        resetSync 
    } = useSprintStartSync();

    const syncStatus = { isSyncing, current, total, logs };

    const snapshotEntries = useMemo(() => {
        if (!selectedSprint || rawLogs.length === 0) return [];
        return getSprintStartSnapshot(selectedSprint, rawLogs);
    }, [selectedSprint, rawLogs, getSprintStartSnapshot]);

    useEffect(() => {
        setLocalEntries(snapshotEntries);
        setSelectedTaskIds(new Set());
    }, [snapshotEntries]);

    const handleLocalStatusChange = useCallback((taskId: string, newStatus: string) => {
        setLocalEntries(prev => prev.map(entry => {
            if (entry.taskId !== taskId) return entry;
            return {
                ...entry,
                confirmedStatus: newStatus,
                isOverridden: newStatus !== entry.autoDetectedStatus,
            };
        }));
        onSaveOverride(selectedSprint, taskId, newStatus);
    }, [selectedSprint, onSaveOverride]);

    const handleResetToAuto = useCallback((taskId: string) => {
        setLocalEntries(prev => prev.map(entry => {
            if (entry.taskId !== taskId) return entry;
            return {
                ...entry,
                confirmedStatus: entry.autoDetectedStatus,
                isOverridden: false,
            };
        }));
        onClearOverride(selectedSprint, taskId);
    }, [selectedSprint, onClearOverride]);

    const handleBulkStatusChange = useCallback((newStatus: string) => {
        const taskIds = Array.from(selectedTaskIds);
        setLocalEntries(prev => prev.map(entry => {
            if (!selectedTaskIds.has(entry.taskId)) return entry;
            return {
                ...entry,
                confirmedStatus: newStatus,
                isOverridden: newStatus !== entry.autoDetectedStatus,
            };
        }));
        onBulkSaveOverrides(selectedSprint, taskIds.map(taskId => ({ taskId, status: newStatus })));
        setSelectedTaskIds(new Set());
        setShowBulkMenu(false);
    }, [selectedSprint, selectedTaskIds, onBulkSaveOverrides]);

    const handleConfirmAll = useCallback(() => {
        onConfirmAll(selectedSprint, localEntries);
    }, [selectedSprint, localEntries, onConfirmAll]);

    const handleSyncToLark = useCallback(() => {
        setShowSyncModal(true);
        syncToLark(selectedSprint, localEntries);
    }, [selectedSprint, localEntries, syncToLark]);

    const handleClearAllOverrides = useCallback(() => {
        if (confirm('Reset all overrides to auto-detected values?')) {
            setLocalEntries(prev => prev.map(entry => ({
                ...entry,
                confirmedStatus: entry.autoDetectedStatus,
                isOverridden: false,
            })));
            onClearAllOverrides(selectedSprint);
        }
    }, [selectedSprint, onClearAllOverrides]);

    const toggleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    };

    const filteredAndSortedEntries = useMemo(() => {
        let filtered = localEntries;

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(e =>
                e.taskId.toLowerCase().includes(q) ||
                e.taskName.toLowerCase().includes(q) ||
                e.person.toLowerCase().includes(q) ||
                e.module.toLowerCase().includes(q)
            );
        }

        if (statusFilter !== 'all') {
            if (statusFilter === 'overridden') {
                filtered = filtered.filter(e => e.isOverridden);
            } else {
                filtered = filtered.filter(e => e.confirmedStatus === statusFilter);
            }
        }

        return [...filtered].sort((a, b) => {
            let cmp = 0;
            switch (sortKey) {
                case 'taskId':
                    cmp = a.taskId.localeCompare(b.taskId);
                    break;
                case 'taskName':
                    cmp = a.taskName.localeCompare(b.taskName);
                    break;
                case 'person':
                    cmp = a.person.localeCompare(b.person);
                    break;
                case 'module':
                    cmp = a.module.localeCompare(b.module);
                    break;
                case 'autoDetectedStatus':
                    cmp = a.autoDetectedStatus.localeCompare(b.autoDetectedStatus);
                    break;
                case 'confirmedStatus':
                    cmp = a.confirmedStatus.localeCompare(b.confirmedStatus);
                    break;
            }
            return sortDir === 'desc' ? -cmp : cmp;
        });
    }, [localEntries, searchQuery, statusFilter, sortKey, sortDir]);

    const stats = useMemo(() => {
        const overriddenCount = localEntries.filter(e => e.isOverridden).length;
        const statusCounts: Record<string, number> = {};
        localEntries.forEach(e => {
            statusCounts[e.confirmedStatus] = (statusCounts[e.confirmedStatus] || 0) + 1;
        });
        return { total: localEntries.length, overridden: overriddenCount, statusCounts };
    }, [localEntries]);

    const toggleSelectAll = () => {
        if (selectedTaskIds.size === filteredAndSortedEntries.length) {
            setSelectedTaskIds(new Set());
        } else {
            setSelectedTaskIds(new Set(filteredAndSortedEntries.map(e => e.taskId)));
        }
    };

    const toggleTaskSelection = (taskId: string) => {
        setSelectedTaskIds(prev => {
            const next = new Set(prev);
            if (next.has(taskId)) {
                next.delete(taskId);
            } else {
                next.add(taskId);
            }
            return next;
        });
    };

    const SortHeader = ({ label, sortKeyName, className = '' }: { label: string; sortKeyName: SortKey; className?: string }) => (
        <button
            onClick={() => toggleSort(sortKeyName)}
            className={`flex items-center gap-1 text-[10px] uppercase tracking-widest font-black cursor-pointer hover:text-foreground transition-colors ${sortKey === sortKeyName ? 'text-indigo-600 dark:text-indigo-400' : 'text-muted-foreground'} ${className}`}
        >
            {label}
            <ArrowUpDown className="w-2.5 h-2.5" />
        </button>
    );

    if (!selectedSprint) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground bg-secondary/20 rounded-xl border border-border/50">
                <Flag className="w-12 h-12 mb-4 opacity-20" />
                <p className="text-sm font-bold">Select a sprint to view its starting status snapshot</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between p-4 bg-secondary/40 rounded-xl border border-border/50 shadow-sm">
                <div>
                    <h3 className="text-sm font-black text-foreground flex items-center gap-2 tracking-tight">
                        <Flag className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        Sprint {selectedSprint} Starting Status
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-1 font-medium">
                        Auto-detected from earliest log entry where sprint and status are set
                    </p>
                </div>
                <div className="flex gap-2">
                    {stats.overridden > 0 && (
                        <button
                            onClick={handleClearAllOverrides}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary hover:bg-muted text-muted-foreground hover:text-foreground text-[10px] font-black uppercase tracking-wider rounded-lg border border-border transition-all active:scale-95 shadow-sm"
                        >
                            <RotateCcw className="w-3 h-3" />
                            Reset All
                        </button>
                    )}
                    <button
                        onClick={handleSyncToLark}
                        className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-wider rounded-lg transition-all active:scale-95 shadow-sm shadow-indigo-200 dark:shadow-indigo-900/40 border border-indigo-500/30"
                    >
                        <CloudSync className="w-3.5 h-3.5" />
                        Sync to Lark
                    </button>
                    <button
                        onClick={handleConfirmAll}
                        className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-wider rounded-lg transition-all active:scale-95 shadow-sm shadow-blue-200 dark:shadow-blue-900/40 border border-blue-500/30"
                    >
                        <Save className="w-3 h-3" />
                        Confirm All
                    </button>
                </div>
            </div>

            {/* Search & Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search tasks..."
                        className="pl-9 pr-3 py-2 bg-background border border-border text-foreground text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 w-64 shadow-sm"
                    />
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    {/* Status Filter */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <Filter className="w-3.5 h-3.5 text-muted-foreground/50" />
                        <button
                            onClick={() => setStatusFilter('all')}
                            className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all shadow-sm ${statusFilter === 'all'
                                ? 'bg-indigo-600 text-white shadow-indigo-100 dark:shadow-indigo-900/40'
                                : 'bg-secondary text-muted-foreground hover:bg-muted hover:text-foreground border border-border/50'
                                }`}
                        >
                            All ({stats.total})
                        </button>
                        <button
                            onClick={() => setStatusFilter('overridden')}
                            className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all shadow-sm ${statusFilter === 'overridden'
                                ? 'bg-amber-600 text-white shadow-amber-100 dark:shadow-amber-900/40'
                                : 'bg-secondary text-muted-foreground hover:bg-muted hover:text-foreground border border-border/50'
                                }`}
                        >
                            Overridden ({stats.overridden})
                        </button>
                    </div>

                    {/* Bulk Actions */}
                    {selectedTaskIds.size > 0 && (
                        <div className="relative">
                            <button
                                onClick={() => setShowBulkMenu(!showBulkMenu)}
                                className="flex items-center gap-2 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-black uppercase tracking-wider rounded-lg transition-all shadow-sm active:scale-95 border border-amber-500/30"
                            >
                                <Edit3 className="w-3 h-3" />
                                Bulk Edit ({selectedTaskIds.size})
                                <ChevronDown className="w-3 h-3" />
                            </button>
                            {showBulkMenu && (
                                <div className="absolute right-0 top-full mt-1 z-50 bg-card border border-border rounded-xl shadow-xl py-1 min-w-[180px] animate-in fade-in slide-in-from-top-2">
                                    <div className="px-3 py-2 text-[9px] text-muted-foreground uppercase tracking-widest font-black border-b border-border/50 text-center">
                                        Set Confirmed Status To
                                    </div>
                                    <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
                                        {STATUS_OPTIONS.map(status => (
                                            <button
                                                key={status}
                                                onClick={() => handleBulkStatusChange(status)}
                                                className="w-full text-left px-4 py-2 text-[10px] font-bold text-foreground hover:bg-muted transition-colors"
                                            >
                                                {status}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Tasks Table */}
            {localEntries.length > 0 ? (
                <div className="overflow-x-auto border border-border/50 rounded-xl shadow-sm bg-card">
                    {/* Table Header */}
                    <table className="w-full min-w-[1100px] table-fixed">
                        <thead>
                            <tr className="bg-muted/50 border-b border-border/50">
                                <th className="w-[40px] px-2 py-3">
                                    <button
                                        onClick={toggleSelectAll}
                                        className="flex justify-center text-muted-foreground/50 hover:text-foreground w-full transition-colors"
                                    >
                                        {selectedTaskIds.size === filteredAndSortedEntries.length && filteredAndSortedEntries.length > 0 ? (
                                            <CheckSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                        ) : (
                                            <Square className="w-4 h-4" />
                                        )}
                                    </button>
                                </th>
                                <th className="w-[110px] px-3 py-3 text-left">
                                    <SortHeader label="Task ID" sortKeyName="taskId" />
                                </th>
                                <th className="w-[280px] px-3 py-3 text-left">
                                    <SortHeader label="Task Name" sortKeyName="taskName" />
                                </th>
                                <th className="w-[180px] px-3 py-3 text-left">
                                    <SortHeader label="Person" sortKeyName="person" />
                                </th>
                                <th className="w-[100px] px-3 py-3 text-left">
                                    <SortHeader label="Module" sortKeyName="module" />
                                </th>
                                <th className="w-[140px] px-3 py-3 text-left">
                                    <SortHeader label="Auto Status" sortKeyName="autoDetectedStatus" />
                                </th>
                                <th className="w-[150px] px-3 py-3 text-left">
                                    <SortHeader label="Confirmed" sortKeyName="confirmedStatus" />
                                </th>
                                <th className="w-[50px] px-2 py-3 text-center">
                                    <span className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">Diff</span>
                                </th>
                                <th className="w-[50px] px-2 py-3 text-center">
                                    <span className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">Link</span>
                                </th>
                            </tr>
                        </thead>
                    </table>

                    {/* Table Body */}
                    <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
                        <table className="w-full min-w-[1100px] table-fixed">
                            <tbody className="divide-y divide-border/40">
                                {filteredAndSortedEntries.map(entry => {
                                    const isSelected = selectedTaskIds.has(entry.taskId);
                                    const persons = entry.person ? entry.person.split(',').map(p => p.trim()).filter(Boolean) : [];

                                    return (
                                        <tr
                                            key={entry.taskId}
                                            className={`transition-all ${entry.isOverridden
                                                ? 'bg-amber-50/50 dark:bg-amber-950/20 border-l-2 border-amber-500'
                                                : isSelected
                                                    ? 'bg-indigo-50/50 dark:bg-indigo-950/20'
                                                    : 'hover:bg-muted/50'
                                                }`}
                                        >
                                            {/* Checkbox */}
                                            <td className="w-[40px] px-2 py-3 align-top">
                                                <button
                                                    onClick={() => toggleTaskSelection(entry.taskId)}
                                                    className="flex justify-center text-muted-foreground/40 hover:text-foreground w-full pt-1 transition-colors"
                                                >
                                                    {isSelected ? (
                                                        <CheckSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                                    ) : (
                                                        <Square className="w-4 h-4" />
                                                    )}
                                                </button>
                                            </td>

                                            {/* Task ID */}
                                            <td className="w-[110px] px-3 py-3 align-top">
                                                <span className="font-mono text-[11px] text-muted-foreground font-bold break-all tracking-tight opacity-70">{entry.taskId}</span>
                                            </td>

                                            {/* Task Name - Wrapping enabled */}
                                            <td className="w-[280px] px-3 py-3 align-top">
                                                <span className="text-xs text-foreground font-semibold break-words leading-relaxed group-hover:text-primary transition-colors">
                                                    {entry.taskName}
                                                </span>
                                            </td>

                                            {/* Person - Chips UI */}
                                            <td className="w-[180px] px-3 py-3 align-top">
                                                {persons.length > 0 ? (
                                                    <div className="flex flex-wrap gap-1">
                                                        {persons.map((person, idx) => (
                                                            <span
                                                                key={idx}
                                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary border border-border text-[10px] font-bold text-muted-foreground uppercase tracking-tight"
                                                            >
                                                                <User className="w-2.5 h-2.5 text-muted-foreground/50" />
                                                                {person}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] text-muted-foreground/30 font-bold">—</span>
                                                )}
                                            </td>

                                            {/* Module */}
                                            <td className="w-[100px] px-3 py-3 align-top">
                                                <span className="text-[10px] text-muted-foreground font-bold break-words opacity-60">
                                                    {entry.module || '—'}
                                                </span>
                                            </td>

                                            {/* Auto-Detected Status */}
                                            <td className="w-[140px] px-3 py-3 align-top">
                                                <div className="flex flex-col gap-1.5 font-bold">
                                                    <span 
                                                        className="text-[9px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border/50 inline-block w-fit uppercase tracking-tight"
                                                        title={entry.autoDetectedStatus}
                                                    >
                                                        {entry.autoDetectedStatus}
                                                    </span>
                                                    <span 
                                                        className="text-[9px] text-muted-foreground/40 flex items-center gap-1 font-mono" 
                                                        title={format(new Date(entry.autoDetectedTimestamp), 'PPpp')}
                                                    >
                                                        <Clock className="w-2.5 h-2.5" />
                                                        {format(new Date(entry.autoDetectedTimestamp), 'MMM d, HH:mm')}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Confirmed Status (Editable) */}
                                            <td className="w-[150px] px-3 py-3 align-top">
                                                <select
                                                    value={entry.confirmedStatus}
                                                    onChange={(e) => handleLocalStatusChange(entry.taskId, e.target.value)}
                                                    className={`text-[11px] font-bold px-2 py-1.5 rounded-lg border focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full transition-all shadow-sm ${entry.isOverridden
                                                        ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-700'
                                                        : 'bg-background text-foreground border-border'
                                                        }`}
                                                >
                                                    {STATUS_OPTIONS.map(status => (
                                                        <option key={status} value={status}>{status}</option>
                                                    ))}
                                                </select>
                                            </td>

                                            {/* Override Indicator / Reset */}
                                            <td className="w-[50px] px-2 py-3 align-top">
                                                <div className="flex justify-center pt-1.5">
                                                    {entry.isOverridden ? (
                                                        <button
                                                            onClick={() => handleResetToAuto(entry.taskId)}
                                                            className="text-amber-600 dark:text-amber-400 hover:scale-110 transition-transform"
                                                            title="Reset to auto-detected"
                                                        >
                                                            <RotateCcw className="w-3.5 h-3.5" />
                                                        </button>
                                                    ) : (
                                                        <div className="w-4 h-4 rounded-full bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center">
                                                            <Check className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                                                        </div>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Record Link */}
                                            <td className="w-[50px] px-2 py-3 align-top">
                                                <div className="flex justify-center pt-1.5">
                                                    {entry.recordLink ? (
                                                        <a
                                                            href={entry.recordLink}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-indigo-600 dark:text-indigo-400 hover:scale-110 transition-transform"
                                                            title="Open in source system"
                                                        >
                                                            <ExternalLink className="w-3.5 h-3.5" />
                                                        </a>
                                                    ) : (
                                                        <span className="text-muted-foreground/30 font-bold">—</span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground bg-secondary/20 rounded-xl border border-border/50 shadow-inner">
                    <Flag className="w-10 h-10 mb-3 opacity-20" />
                    <p className="text-sm font-bold">No tasks found for Sprint {selectedSprint}</p>
                    <p className="text-[10px] mt-1 opacity-60 px-8 text-center max-w-md font-medium leading-relaxed">
                        {rawLogs.length === 0 
                            ? 'No log data loaded yet - waiting for API response'
                            : `${rawLogs.length} logs loaded, but none match the criteria for sprint ${selectedSprint}.`
                        }
                    </p>
                </div>
            )}

            {/* Summary Stats */}
            {localEntries.length > 0 && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 bg-secondary/20 px-4 py-2 rounded-lg border border-border/40">
                    <span className="flex items-center gap-1.5">Total: <span className="text-foreground font-mono">{stats.total}</span></span>
                    <span className="opacity-20 text-foreground">|</span>
                    <span className="flex items-center gap-1.5">Overridden: <span className="text-amber-600 dark:text-amber-400 font-mono">{stats.overridden}</span></span>
                    <span className="opacity-20 text-foreground">|</span>
                    <span className="flex items-center gap-1.5">Selected: <span className="text-indigo-600 dark:text-indigo-400 font-mono">{selectedTaskIds.size}</span></span>
                    <span className="opacity-20 text-foreground">|</span>
                    <span className="flex items-center gap-1.5">Showing: <span className="text-foreground font-mono">{filteredAndSortedEntries.length}</span></span>
                </div>
            )}

            {/* Sync Progress Modal */}
            <SprintStartSyncModal
                isOpen={showSyncModal}
                onClose={() => setShowSyncModal(false)}
                syncStatus={syncStatus}
                sprint={selectedSprint}
            />
        </div>
    );
}
