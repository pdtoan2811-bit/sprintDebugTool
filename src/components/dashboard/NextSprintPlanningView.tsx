'use client';

import React, { useMemo, useState, useCallback, DragEvent } from 'react';
import { TaskAnalysis, RawLogEvent } from '@/lib/types';
import { useNextSprintPlan, DraftTask } from '@/lib/hooks/useNextSprintPlan';
import { fetchLogs } from '@/lib/api';
import { getStatusSeverity, isBottleneckStatus } from '@/lib/workflow-engine';
import {
    Calendar,
    Send,
    Target,
    Zap,
    Users,
    Circle,
    PlayCircle,
    AlertTriangle,
    Loader2,
    Trash2,
    Plus,
    User,
    Layers,
    GripVertical,
    CheckCircle2,
    XCircle,
    Clock,
    RefreshCw,
    ShieldCheck
} from 'lucide-react';
import { Badge } from '../ui/badge';

import { SyncProgress, SyncTaskResult, SyncTaskStatus, VerificationResult } from './next-sprint/types';
import { priorityDotColor, StatusBadge } from '@/lib/status-utils';
import { TaskCard } from './TaskCard';

interface NextSprintPlanningViewProps {
    analyses: Record<string, TaskAnalysis>;
    rawLogs: RawLogEvent[];
    activeSprint: string;
    onTaskClick: (taskId: string) => void;
}

export function NextSprintPlanningView({
    analyses,
    rawLogs,
    activeSprint,
    onTaskClick
}: NextSprintPlanningViewProps) {
    const {
        drafts,
        isLoading,
        addDraft,
        removeDraft,
        updateDraft,
        bulkUpdateDrafts,
        getDraftsArray
    } = useNextSprintPlan(activeSprint);

    const [selectedPersonsFilter, setSelectedPersonsFilter] = useState<Set<string>>(new Set());
    const [dragOverPlan, setDragOverPlan] = useState(false);
    
    // Bulk Edit States
    const [bulkTargetSprint, setBulkTargetSprint] = useState<string>(activeSprint ? String(parseInt(activeSprint) + 1) : '');
    const [bulkTargetStatus, setBulkTargetStatus] = useState<string>('');
    const [bulkTargetSprintGoal, setBulkTargetSprintGoal] = useState<string>('');
    
    const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
    const isSyncing = syncProgress !== null && syncProgress.phase !== 'done';

    // Get all uncompleted tasks and all unique persons
    const { allPersons, allUncompletedTasks } = useMemo(() => {
        const persons = new Set<string>();
        const uncompleted: TaskAnalysis[] = [];
        Object.values(analyses).forEach(t => {
            if (t.currentStatus !== 'Completed' && t.currentStatus !== 'Staging Passed') {
                if (activeSprint && String(t.sprint) !== String(activeSprint)) return;
                uncompleted.push(t);
                const assignees = t.currentPerson ? t.currentPerson.split(',').map(p => p.trim()).filter(Boolean) : [];
                assignees.forEach(p => persons.add(p));
            }
        });
        return { 
            allPersons: Array.from(persons).sort((a,b) => a.localeCompare(b)),
            allUncompletedTasks: uncompleted 
        };
    }, [analyses]);

    const squadMembers = Array.from(selectedPersonsFilter).sort((a,b) => a.localeCompare(b));

    // Compute backlog for the selected squad
    const { combinationBacklogs, individualBacklog } = useMemo(() => {
        if (squadMembers.length === 0) return { combinationBacklogs: [], individualBacklog: {} };
        
        const combinations = new Map<string, TaskAnalysis[]>();
        const individual: Record<string, TaskAnalysis[]> = {};
        squadMembers.forEach(sm => individual[sm] = []);

        allUncompletedTasks.forEach(task => {
            if (drafts[task.taskId]) return; // Exclude drafted ones from backlog

            const assignees = task.currentPerson ? task.currentPerson.split(',').map(p => p.trim()) : [];
            const involved = squadMembers.filter(sm => assignees.includes(sm));
            
            if (involved.length > 1) {
                involved.sort((a, b) => a.localeCompare(b));
                const key = involved.join('|');
                if (!combinations.has(key)) combinations.set(key, []);
                combinations.get(key)!.push(task);
            } else if (involved.length === 1) {
                if (!individual[involved[0]].some(t => t.taskId === task.taskId)) {
                    individual[involved[0]].push(task);
                }
            }
        });

        const combinationArray = Array.from(combinations.entries()).map(([key, tasks]) => {
            // Sort to look nice
            tasks.sort((a, b) => a.taskName.localeCompare(b.taskName));
            return {
                involvedList: key.split('|'),
                tasks
            };
        });

        combinationArray.sort((a, b) => {
            if (a.involvedList.length !== b.involvedList.length) return b.involvedList.length - a.involvedList.length;
            return a.involvedList.join(',').localeCompare(b.involvedList.join(','));
        });

        return { combinationBacklogs: combinationArray, individualBacklog: individual };
    }, [allUncompletedTasks, squadMembers, drafts]);

    // Tasks that are drafted and involve the squad
    const squadDrafts = useMemo(() => {
        const array = getDraftsArray();
        if (squadMembers.length === 0) return [];
        return array.filter(d => {
            const task = analyses[d.taskId];
            if (!task) return false;
            const assignees = task.currentPerson ? task.currentPerson.split(',').map(p => p.trim()) : [];
            return squadMembers.some(sm => assignees.includes(sm));
        });
    }, [getDraftsArray, analyses, squadMembers]);

    const handleDragStart = (e: DragEvent, taskId: string) => {
        e.dataTransfer.setData('text/plain', taskId);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDrop = (e: DragEvent) => {
        e.preventDefault();
        setDragOverPlan(false);
        const taskId = e.dataTransfer.getData('text/plain');
        if (taskId && analyses[taskId]) {
            const task = analyses[taskId];
            addDraft({
                taskId,
                targetSprint: bulkTargetSprint,
                targetStatus: task.currentStatus,
                targetSprintGoal: task.sprintGoal || ''
            });
        }
    };

    const handleApplyBulkEdits = () => {
        const squadTaskIds = squadDrafts.map(d => d.taskId);
        if (squadTaskIds.length > 0) {
            const updates: Partial<DraftTask> = {};
            if (bulkTargetSprint) updates.targetSprint = bulkTargetSprint;
            if (bulkTargetStatus) updates.targetStatus = bulkTargetStatus;
            if (bulkTargetSprintGoal !== '') updates.targetSprintGoal = bulkTargetSprintGoal;
            
            if (Object.keys(updates).length > 0) {
                bulkUpdateDrafts(updates, squadTaskIds);
            }
        }
    };

    const SYNC_DELAY_MS = 1500;

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const handleSendToWebhook = useCallback(async () => {
        if (squadDrafts.length === 0 || squadMembers.length === 0) return;

        const initialResults: SyncTaskResult[] = squadDrafts.map(d => {
            const task = analyses[d.taskId];
            return {
                taskId: d.taskId,
                taskName: task ? task.taskName : 'Unknown',
                status: 'pending' as SyncTaskStatus,
            };
        });

        setSyncProgress({
            total: squadDrafts.length,
            completed: 0,
            currentTaskId: null,
            results: initialResults,
            phase: 'sending',
            verifyStatus: 'idle',
            verificationResults: [],
        });

        const updatedResults = [...initialResults];
        let completedCount = 0;

        // ── Sequential per-task sending ──
        for (let i = 0; i < squadDrafts.length; i++) {
            const draft = squadDrafts[i];
            const task = analyses[draft.taskId];

            // Mark current task as sending
            updatedResults[i] = { ...updatedResults[i], status: 'sending' };
            setSyncProgress(prev => prev ? {
                ...prev,
                currentTaskId: draft.taskId,
                results: [...updatedResults],
            } : prev);

            const payload = {
                person: task ? task.currentPerson : squadMembers[0],
                eventType: 'sprint_planning_task',
                currentSprint: activeSprint,
                targetSprint: draft.targetSprint,
                squadMembers,
                taskId: draft.taskId,
                taskName: task ? task.taskName : 'Unknown',
                recordLink: task ? task.recordLink : '',
                targetStatus: draft.targetStatus,
                targetSprintGoal: draft.targetSprintGoal,
            };

            try {
                const res = await fetch('/api/send-todo-webhook', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });

                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.error || `HTTP error ${res.status}`);
                }

                updatedResults[i] = { ...updatedResults[i], status: 'success' };
            } catch (error) {
                updatedResults[i] = {
                    ...updatedResults[i],
                    status: 'failed',
                    error: error instanceof Error ? error.message : 'Unknown error',
                };
            }

            completedCount++;
            setSyncProgress(prev => prev ? {
                ...prev,
                completed: completedCount,
                results: [...updatedResults],
            } : prev);

            // Wait between tasks (skip delay after the last one)
            if (i < squadDrafts.length - 1) {
                await sleep(SYNC_DELAY_MS);
            }
        }

        // ── Verification phase: re-fetch from Google Sheet ──
        setSyncProgress(prev => prev ? {
            ...prev,
            phase: 'verifying',
            verifyStatus: 'verifying',
            currentTaskId: null,
        } : prev);

        let verificationResults: VerificationResult[] = [];
        try {
            // Small delay to let the Lark automation propagate
            await sleep(2000);
            const freshLogs = await fetchLogs(activeSprint || undefined);

            // Build a map of the latest status per task from the fresh data
            const freshTaskMap = new Map<string, RawLogEvent>();
            freshLogs.forEach(log => {
                const existing = freshTaskMap.get(log.taskId);
                if (!existing || new Date(log.timestamp) > new Date(existing.timestamp)) {
                    freshTaskMap.set(log.taskId, log);
                }
            });

            verificationResults = squadDrafts.map(draft => {
                const task = analyses[draft.taskId];
                const freshLog = freshTaskMap.get(draft.taskId);
                const taskName = task ? task.taskName : 'Unknown';

                if (!freshLog) {
                    return {
                        taskId: draft.taskId,
                        taskName,
                        matched: false,
                        detail: 'Task not found in Google Sheet data',
                    };
                }

                // Check if the sheet reflects the target values
                const checks: string[] = [];
                if (freshLog.sprint !== draft.targetSprint) {
                    checks.push(`Sprint: sheet="${freshLog.sprint}" vs planned="${draft.targetSprint}"`);
                }
                if (freshLog.status !== draft.targetStatus) {
                    checks.push(`Status: sheet="${freshLog.status}" vs planned="${draft.targetStatus}"`);
                }
                if (draft.targetSprintGoal && freshLog.sprintGoal !== draft.targetSprintGoal) {
                    checks.push(`Goal: sheet="${freshLog.sprintGoal}" vs planned="${draft.targetSprintGoal}"`);
                }

                if (checks.length === 0) {
                    return { taskId: draft.taskId, taskName, matched: true, detail: 'All fields match' };
                } else {
                    return { taskId: draft.taskId, taskName, matched: false, detail: checks.join(' · ') };
                }
            });
        } catch (error) {
            console.error('Verification fetch failed:', error);
            verificationResults = squadDrafts.map(d => ({
                taskId: d.taskId,
                taskName: analyses[d.taskId]?.taskName || 'Unknown',
                matched: false,
                detail: 'Verification fetch failed — could not reach Google Sheet',
            }));
        }

        setSyncProgress(prev => prev ? {
            ...prev,
            phase: 'done',
            verifyStatus: 'done',
            verificationResults,
        } : prev);
    }, [squadDrafts, squadMembers, analyses, activeSprint, bulkTargetSprint]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    const renderCard = (task: TaskAnalysis, context: 'backlog') => {
        return (
            <div key={task.taskId} className="relative group/card">
                <TaskCard
                    task={task}
                    onTaskClick={onTaskClick}
                    isDraggable={true}
                    onDragStart={handleDragStart}
                    showMetadata={true}
                    actions={
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                addDraft({
                                    taskId: task.taskId,
                                    targetSprint: bulkTargetSprint,
                                    targetStatus: task.currentStatus,
                                    targetSprintGoal: task.sprintGoal || ''
                                });
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1D3557] hover:bg-[#1D3557]/90 text-white text-[10px] font-bold transition-all shadow-lg shadow-[#1D3557]/20 active:scale-95 ml-1"
                            title="Add to draft plan"
                        >
                            <Plus className="w-3 h-3" />
                            Add
                        </button>
                    }
                />
            </div>
        );
    };

    return (
        <div className="flex flex-col gap-6 pb-12 min-h-screen">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-2 text-foreground tracking-tight">
                        <Calendar className="w-5 h-5 text-[#1D3557] dark:text-indigo-400" />
                        Next Sprint Squad Planning
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1 max-w-2xl font-medium">
                        Form a dynamic squad below. Uncompleted tasks belonging to squad members will appear in the backlog. 
                        Draft them to the Squad Plan, apply bulk updates, and sync to Lark in one click.
                    </p>
                </div>
            </div>

            {/* Personnel Selector Row */}
            <div className="bg-secondary/40 p-4 rounded-xl border border-border flex flex-col gap-3 flex-shrink-0 shadow-sm">
                <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#1D3557] dark:text-indigo-400" />
                    <span className="font-bold text-foreground text-sm tracking-tight">Gradually form your squad</span>
                </div>
                <div className="flex items-center gap-2.5 overflow-x-auto pb-2 custom-scrollbar">
                    {allPersons.map(p => {
                        const isSelected = selectedPersonsFilter.has(p);
                        return (
                            <button
                                key={p}
                                onClick={() => {
                                    const next = new Set(selectedPersonsFilter);
                                    if (isSelected) next.delete(p);
                                    else next.add(p);
                                    setSelectedPersonsFilter(next);
                                }}
                                className={`flex-shrink-0 flex items-center gap-2 px-3.5 py-1.5 rounded-full border transition-all shadow-sm ${
                                    isSelected 
                                        ? 'bg-[#1D3557] border-indigo-500 text-white shadow-indigo-200 dark:shadow-indigo-900/40'
                                        : 'bg-card border-border text-muted-foreground hover:bg-background hover:text-foreground hover:border-muted-foreground/30'
                                }`}
                            >
                                <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white/80' : 'bg-muted-foreground/30'}`} />
                                <span className="text-xs font-bold">{p}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {selectedPersonsFilter.size === 0 ? (
                <div className="flex-1 flex items-center justify-center rounded-xl border border-border bg-card shadow-sm min-h-[400px]">
                    <div className="text-center py-12 px-4 max-w-md">
                        <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground/20" />
                        <h3 className="text-foreground font-bold mb-2 text-lg tracking-tight">No Squad Selected</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed font-medium">
                            Pick one or more personnel above. The backlog will automatically populate with existing unfinished work related to those personnel.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-[45%_55%] xl:grid-cols-[40%_60%] gap-6 flex-1 items-start">
                    {/* Left Column: Squad Backlog */}
                    <div className="rounded-xl border border-border bg-card/60 p-5 shadow-sm flex flex-col h-[75vh]">
                        <div className="flex items-center justify-between mb-5 pb-3 border-b border-border shrink-0">
                            <div className="flex items-center gap-2">
                                <Layers className="w-4 h-4 text-[#1D3557] dark:text-indigo-400" />
                                <h3 className="font-bold text-foreground text-sm tracking-tight">Squad Uncompleted Backlog</h3>
                            </div>
                            <div className="text-[10px] text-muted-foreground flex items-center gap-1 font-bold">
                                <GripVertical className="w-3 h-3" />
                                Drag tasks to draft
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-6 pb-6">
                            {/* Combination Backlog */}
                            {combinationBacklogs.map(group => (
                                <div key={group.involvedList.join('|')} className="space-y-3">
                                    <div className="flex items-center gap-2 text-[#1D3557] dark:text-indigo-400 border-b border-indigo-100 dark:border-indigo-900/30 pb-1.5">
                                        <Users className="w-3.5 h-3.5" />
                                        <h4 className="text-[13px] font-bold tracking-tight">
                                            {group.involvedList.length === squadMembers.length 
                                                ? `Shared by Squad (${group.tasks.length})`
                                                : `Shared: ${group.involvedList.join(', ')} (${group.tasks.length})`}
                                        </h4>
                                    </div>
                                    <div className="space-y-2.5">
                                        {group.tasks.map(task => renderCard(task, 'backlog'))}
                                    </div>
                                </div>
                            ))}

                            {/* Individual Backlog */}
                            {squadMembers.map(member => {
                                const tasks = individualBacklog[member] || [];
                                if (tasks.length === 0) return null;
                                return (
                                    <div key={member} className="space-y-3">
                                        <div className="flex items-center gap-2 text-muted-foreground border-b border-border/50 pb-1.5">
                                            <User className="w-3.5 h-3.5" />
                                            <h4 className="text-[13px] font-bold tracking-tight">{member}'s Tasks ({tasks.length})</h4>
                                        </div>
                                        <div className="space-y-2.5">
                                            {tasks.map(task => renderCard(task, 'backlog'))}
                                        </div>
                                    </div>
                                );
                            })}
                            
                            {combinationBacklogs.length === 0 && squadMembers.every(m => individualBacklog[m].length === 0) && (
                                <div className="text-center py-12 text-muted-foreground text-sm font-medium opacity-60">
                                    No tasks to roll over.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Squad Plan */}
                    <div 
                        onDragOver={(e) => { e.preventDefault(); setDragOverPlan(true); }}
                        onDragLeave={() => setDragOverPlan(false)}
                        onDrop={handleDrop}
                        className={`rounded-xl border p-5 flex flex-col h-[75vh] shadow-lg transition-all ${
                            dragOverPlan
                                ? 'border-emerald-500/50 bg-emerald-50 dark:bg-emerald-950/10'
                                : 'border-border bg-card'
                        }`}
                    >
                        <div className="flex items-center justify-between mb-4 pb-4 border-b border-border flex-shrink-0">
                            <div className="flex items-center gap-2">
                                <Target className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                <h3 className="font-bold text-foreground text-sm tracking-tight">Squad Draft Plan</h3>
                                <Badge variant="outline" className="bg-muted text-muted-foreground border-border">{squadDrafts.length}</Badge>
                            </div>
                            
                            <button
                                onClick={handleSendToWebhook}
                                disabled={squadDrafts.length === 0 || isSyncing}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:bg-muted disabled:text-muted-foreground text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center gap-2 active:scale-95 border border-emerald-500/30"
                            >
                                {isSyncing ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : syncProgress?.phase === 'done' ? (
                                    <CheckCircle2 className="w-4 h-4 text-white" />
                                ) : (
                                    <Send className="w-4 h-4" />
                                )}
                                {isSyncing
                                    ? `Syncing ${syncProgress?.completed ?? 0}/${syncProgress?.total ?? 0}...`
                                    : syncProgress?.phase === 'done'
                                        ? 'Sync Complete — Resync?'
                                        : 'Confirm & Sync Squad'}
                            </button>
                        </div>

                        {/* ── Sync Progress Panel ── */}
                        {syncProgress && (
                            <div className="mb-4 p-4 bg-secondary/50 border border-border rounded-xl space-y-4 shadow-inner">
                                {/* Progress bar */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-[11px] font-bold tracking-tight">
                                        <span className="text-muted-foreground flex items-center gap-1.5">
                                            {syncProgress.phase === 'sending' && <><Loader2 className="w-3 h-3 animate-spin text-emerald-600 dark:text-emerald-400" /> Sending tasks to Lark…</>}
                                            {syncProgress.phase === 'verifying' && <><RefreshCw className="w-3 h-3 animate-spin text-blue-600 dark:text-blue-400" /> Verifying with Google Sheet…</>}
                                            {syncProgress.phase === 'done' && <><ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> Sync Complete</>}
                                        </span>
                                        <span className="text-muted-foreground font-mono">
                                            {syncProgress.completed}/{syncProgress.total}
                                        </span>
                                    </div>
                                    <div className="w-full bg-muted rounded-full h-2 overflow-hidden border border-border/50">
                                        <div
                                            className="h-full rounded-full transition-all duration-500 ease-out"
                                            style={{
                                                width: `${syncProgress.total > 0 ? (syncProgress.completed / syncProgress.total) * 100 : 0}%`,
                                                background: syncProgress.phase === 'done'
                                                    ? 'linear-gradient(90deg, #10b981, #34d399)'
                                                    : 'linear-gradient(90deg, #6366f1, #818cf8)',
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* Per-task status list */}
                                <div className="space-y-1.5 max-h-[200px] overflow-y-auto custom-scrollbar pr-1">
                                    {syncProgress.results.map(r => (
                                        <div
                                            key={r.taskId}
                                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors border ${
                                                r.status === 'sending'
                                                    ? 'bg-primary/5 border-primary/20'
                                                    : r.status === 'success'
                                                        ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/30'
                                                        : r.status === 'failed'
                                                            ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/30'
                                                            : 'bg-muted/50 border-border/50'
                                            }`}
                                        >
                                            {r.status === 'pending' && <Clock className="w-3 h-3 text-muted-foreground shrink-0" />}
                                            {r.status === 'sending' && <Loader2 className="w-3 h-3 text-primary animate-spin shrink-0" />}
                                            {r.status === 'success' && <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />}
                                            {r.status === 'failed' && <XCircle className="w-3 h-3 text-red-600 dark:text-red-400 shrink-0" />}
                                            <span className="font-mono text-muted-foreground shrink-0">{r.taskId}</span>
                                            <span className="text-foreground font-medium truncate">{r.taskName}</span>
                                            {r.error && (
                                                <span className="ml-auto text-red-600 dark:text-red-400 text-[10px] font-mono shrink-0 truncate max-w-[150px]" title={r.error}>
                                                    {r.error}
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {/* Verification results */}
                                {syncProgress.phase === 'done' && syncProgress.verificationResults.length > 0 && (
                                    <div className="pt-3 border-t border-border space-y-2">
                                        <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-tight text-muted-foreground">
                                            <ShieldCheck className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                                            Google Sheet Verification
                                        </div>
                                        <div className="space-y-1.5 max-h-[180px] overflow-y-auto custom-scrollbar pr-1">
                                            {syncProgress.verificationResults.map(v => (
                                                <div
                                                    key={v.taskId}
                                                    className={`flex items-start gap-2 px-3 py-2 rounded-lg text-xs border ${
                                                        v.matched
                                                            ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/30'
                                                            : 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/30'
                                                    }`}
                                                >
                                                    {v.matched
                                                        ? <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                                                        : <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />}
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="font-mono text-muted-foreground">{v.taskId}</span>
                                                            <span className="text-foreground font-semibold truncate">{v.taskName}</span>
                                                        </div>
                                                        <div className={`text-[10px] mt-0.5 ${v.matched ? 'text-emerald-600 dark:text-emerald-400/80' : 'text-amber-600 dark:text-amber-400/80'} font-mono`}>
                                                            {v.detail}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <p className="text-[10px] text-muted-foreground italic font-medium">
                                            ⚠️ Mismatches may be normal if Lark automation hasn't propagated to the Google Sheet yet.
                                        </p>
                                    </div>
                                )}

                                {/* Close/dismiss button when done */}
                                {syncProgress.phase === 'done' && (
                                    <div className="flex justify-end">
                                        <button
                                            onClick={() => setSyncProgress(null)}
                                            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-muted font-bold"
                                        >
                                            Dismiss
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Bulk Edit Panel */}
                        {squadDrafts.length > 0 && (
                            <div className="mb-4 p-3 bg-secondary/50 border border-border rounded-lg flex-shrink-0 flex flex-col sm:flex-row sm:items-end gap-3 shadow-inner">
                                <div className="space-y-1 flex-1">
                                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-black block">Bulk Set Target Sprint</label>
                                    <input 
                                        type="text" 
                                        value={bulkTargetSprint}
                                        onChange={e => setBulkTargetSprint(e.target.value)}
                                        className="w-full sm:max-w-[120px] bg-background border border-border text-xs text-foreground px-2 py-1.5 rounded focus:border-primary focus:outline-none transition-colors font-mono"
                                        placeholder="e.g. 24"
                                    />
                                </div>
                                <div className="space-y-1 flex-1">
                                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-black block">Bulk Set Target Status</label>
                                    <select 
                                        value={bulkTargetStatus}
                                        onChange={e => setBulkTargetStatus(e.target.value)}
                                        className="w-full sm:max-w-[160px] bg-background border border-border text-xs text-foreground px-2 py-1.5 rounded focus:border-primary focus:outline-none transition-colors appearance-none"
                                    >
                                        <option value="">Keep Existing</option>
                                        <option value="Not Started">Not Started</option>
                                        <option value="In Process">In Process</option>
                                        <option value="Reviewing">Reviewing</option>
                                        <option value="Waiting to Integrate">Waiting to Integrate</option>
                                        <option value="Ready for Test">Ready for Test</option>
                                        <option value="Testing">Testing</option>
                                        <option value="Reprocess">Reprocess</option>
                                        <option value="Bug Fixing">Bug Fixing</option>
                                        <option value="Staging Passed">Staging Passed</option>
                                        <option value="Completed">Completed</option>
                                    </select>
                                </div>
                                <div className="space-y-1 flex-1">
                                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-black block">Bulk Set Sprint Goal</label>
                                    <select 
                                        value={bulkTargetSprintGoal}
                                        onChange={e => setBulkTargetSprintGoal(e.target.value)}
                                        className="w-full sm:max-w-[160px] bg-background border border-border text-xs text-foreground px-2 py-1.5 rounded focus:border-primary focus:outline-none transition-colors appearance-none"
                                    >
                                        <option value="">Keep Existing</option>
                                        <option value="Not Started">Not Started</option>
                                        <option value="In Process">In Process</option>
                                        <option value="Waiting to Integrate">Waiting to Integrate</option>
                                        <option value="Reviewing">Reviewing</option>
                                        <option value="Ready for Test">Ready for Test</option>
                                        <option value="Testing">Testing</option>
                                        <option value="Reprocess">Reprocess</option>
                                        <option value="Bug Fixing">Bug Fixing</option>
                                        <option value="Staging Passed">Staging Passed</option>
                                        <option value="Completed">Completed</option>
                                    </select>
                                </div>
                                <button
                                    onClick={handleApplyBulkEdits}
                                    className="px-3 py-1.5 bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-black rounded shadow-sm transition-all whitespace-nowrap mt-2 sm:mt-0 active:scale-95"
                                >
                                    Apply to {squadDrafts.length} task(s)
                                </button>
                            </div>
                        )}

                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3 pb-6">
                            {squadDrafts.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-3 min-h-[150px]">
                                    {dragOverPlan ? (
                                        <div className="animate-pulse flex flex-col items-center">
                                            <Plus className="w-10 h-10 text-emerald-500/50 mb-2" />
                                            <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">Drop it!</p>
                                        </div>
                                    ) : (
                                        <>
                                            <Calendar className="w-10 h-10 opacity-20" />
                                            <p className="text-sm font-medium">Drag tasks here or click "Add"</p>
                                        </>
                                    )}
                                </div>
                            ) : (
                                squadDrafts.map((draft, idx) => {
                                    const task = analyses[draft.taskId];
                                    return (
                                        <div key={draft.taskId} className="bg-card border border-border rounded-xl p-4 group relative shadow-md hover:border-primary/30 transition-all">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-2.5 min-w-0" onClick={() => onTaskClick(draft.taskId)}>
                                                    <span className="text-[10px] font-mono text-muted-foreground bg-secondary px-1.5 py-0.5 rounded shrink-0">#{idx + 1}</span>
                                                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${task ? priorityDotColor(task.currentStatus) : 'bg-muted'}`} />
                                                    <span className="font-mono text-[10px] text-muted-foreground shrink-0">{draft.taskId}</span>
                                                    <span className="text-sm text-foreground font-black truncate cursor-pointer hover:underline tracking-tight">{task ? task.taskName : 'Unknown'}</span>
                                                </div>
                                                <button
                                                    onClick={() => removeDraft(draft.taskId)}
                                                    className="text-red-500/70 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 p-1.5 rounded transition-colors"
                                                    title="Remove from plan"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                            
                                            {/* Edit Form */}
                                            <div className="grid grid-cols-[1fr_2fr] gap-4">
                                                <div className="space-y-1.5">
                                                    <label className="text-[9px] uppercase tracking-wider text-muted-foreground font-black block">Sprint</label>
                                                    <input 
                                                        type="text" 
                                                        value={draft.targetSprint}
                                                        onChange={e => updateDraft(draft.taskId, { targetSprint: e.target.value })}
                                                        className="w-full bg-background border border-border text-xs font-mono text-foreground px-2 py-1.5 rounded focus:border-primary focus:outline-none transition-colors"
                                                        placeholder="Sprint #"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[9px] uppercase tracking-wider text-muted-foreground font-black block">Status</label>
                                                    <select 
                                                        value={draft.targetStatus}
                                                        onChange={e => updateDraft(draft.taskId, { targetStatus: e.target.value })}
                                                        className="w-full bg-background border border-border text-xs text-foreground px-2 py-1.5 rounded focus:border-primary focus:outline-none transition-colors appearance-none"
                                                    >
                                                        <option value="Not Started">Not Started</option>
                                                        <option value="In Process">In Process</option>
                                                        <option value="Waiting to Integrate">Waiting to Integrate</option>
                                                        <option value="Reviewing">Reviewing</option>
                                                        <option value="Ready for Test">Ready for Test</option>
                                                        <option value="Testing">Testing</option>
                                                        <option value="Reprocess">Reprocess</option>
                                                        <option value="Bug Fixing">Bug Fixing</option>
                                                        <option value="Staging Passed">Staging Passed</option>
                                                        <option value="Completed">Completed</option>
                                                    </select>
                                                </div>
                                                <div className="col-span-2 space-y-1.5">
                                                    <label className="text-[9px] uppercase tracking-wider text-muted-foreground font-black block">Sprint Goal</label>
                                                    <select 
                                                        value={draft.targetSprintGoal}
                                                        onChange={e => updateDraft(draft.taskId, { targetSprintGoal: e.target.value })}
                                                        className="w-full bg-background border border-border text-xs text-foreground px-2 py-1.5 rounded focus:border-primary focus:outline-none transition-colors appearance-none"
                                                    >
                                                        <option value="">(Empty / Ignore)</option>
                                                        <option value="Not Started">Not Started</option>
                                                        <option value="In Process">In Process</option>
                                                        <option value="Waiting to Integrate">Waiting to Integrate</option>
                                                        <option value="Reviewing">Reviewing</option>
                                                        <option value="Ready for Test">Ready for Test</option>
                                                        <option value="Testing">Testing</option>
                                                        <option value="Reprocess">Reprocess</option>
                                                        <option value="Bug Fixing">Bug Fixing</option>
                                                        <option value="Staging Passed">Staging Passed</option>
                                                        <option value="Completed">Completed</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
