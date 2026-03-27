'use client';

import React, { useMemo, useState } from 'react';
import { TaskAnalysis, WORKFLOW_STATUSES } from '@/lib/types';
import { getStatusSeverity } from '@/lib/workflow-engine';
import { hasMetSprintGoal } from '@/lib/utils';
import { priorityDotColor, StatusBadge } from '@/lib/status-utils';
import { Badge } from '../ui/badge';
import {
    AlertTriangle,
    ArrowUpDown,
    CheckCircle2,
    ChevronRight,
    Clock,
    ListTodo,
    Pin,
    RefreshCw,
    Target,
    User,
    Zap,
} from 'lucide-react';

interface TaskOverviewProps {
    analyses: Record<string, TaskAnalysis>;
    highRiskIds: Set<string>;
    onTaskClick: (taskId: string) => void;
}

type SortKey = 'taskId' | 'status' | 'risk' | 'person' | 'stale' | 'blocking' | 'goal';

export function TaskOverview({ analyses, highRiskIds, onTaskClick }: TaskOverviewProps) {
    const [sortKey, setSortKey] = useState<SortKey>('risk');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

    const tasks = useMemo(() => {
        const all = Object.values(analyses);

        const riskOrder: Record<string, number> = { critical: 3, elevated: 2, normal: 1 };

        const sorted = [...all].sort((a, b) => {
            // High risk pinned always goes first
            const aHR = highRiskIds.has(a.taskId) ? 1 : 0;
            const bHR = highRiskIds.has(b.taskId) ? 1 : 0;
            if (aHR !== bHR) return bHR - aHR;

            let cmp = 0;
            switch (sortKey) {
                case 'taskId':
                    cmp = a.taskId.localeCompare(b.taskId);
                    break;
                case 'status': {
                    const statusA = WORKFLOW_STATUSES.find(s => s.name === a.currentStatus)?.index ?? 99;
                    const statusB = WORKFLOW_STATUSES.find(s => s.name === b.currentStatus)?.index ?? 99;
                    cmp = statusA - statusB;
                    break;
                }
                case 'risk':
                    cmp = (riskOrder[a.riskLevel] ?? 0) - (riskOrder[b.riskLevel] ?? 0);
                    break;
                case 'person':
                    cmp = a.currentPerson.localeCompare(b.currentPerson);
                    break;
                case 'stale':
                    cmp = a.staleDurationMs - b.staleDurationMs;
                    break;
                case 'blocking':
                    const aBlocked = a.blockedBy ? 1 : 0;
                    const bBlocked = b.blockedBy ? 1 : 0;
                    cmp = aBlocked - bBlocked || (a.blockedBy ?? '').localeCompare(b.blockedBy ?? '');
                    break;
                case 'goal':
                    const aMetGoal = hasMetSprintGoal(a.currentStatus, a.sprintGoal) ? 1 : 0;
                    const bMetGoal = hasMetSprintGoal(b.currentStatus, b.sprintGoal) ? 1 : 0;
                    cmp = aMetGoal - bMetGoal;
                    break;
            }
            return sortDir === 'desc' ? -cmp : cmp;
        });

        return sorted;
    }, [analyses, highRiskIds, sortKey, sortDir]);

    const toggleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortKey(key);
            setSortDir('desc');
        }
    };

    const SortHeader = ({ label, sortKeyName, className = '' }: { label: string; sortKeyName: SortKey; className?: string }) => (
        <button
            onClick={() => toggleSort(sortKeyName)}
            className={`flex items-center gap-1 text-[11px] font-bold tracking-tight cursor-pointer hover:text-foreground transition-colors ${sortKey === sortKeyName ? 'text-[#1D3557]' : 'text-muted-foreground'} ${className}`}
        >
            {label}
            <ArrowUpDown className="w-2.5 h-2.5" />
        </button>
    );

    const stats = useMemo(() => {
        const total = tasks.length;
        const highRisk = tasks.filter(t => highRiskIds.has(t.taskId)).length;
        const stale = tasks.filter(t => t.isStale).length;
        const metGoal = tasks.filter(t => hasMetSprintGoal(t.currentStatus, t.sprintGoal)).length;
        const blocked = tasks.filter(t => t.blockedBy).length;
        return { total, highRisk, stale, metGoal, blocked };
    }, [tasks, highRiskIds]);

    if (tasks.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground bg-secondary/20 rounded-xl border border-border/50">
                <ListTodo className="w-10 h-10 mb-3 opacity-20" />
                <p className="text-sm font-bold">No tasks to display</p>
                <p className="text-[10px] mt-1 opacity-60">Tasks will appear here once data is loaded</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {/* Tasks Table */}
            <div className="overflow-x-auto border border-border/50 rounded-xl shadow-sm bg-card">
                {/* Table Header */}
                <table className="w-full min-w-[1170px] table-fixed">
                    <thead>
                        <tr className="bg-muted/50 border-b border-border/50">
                            <th className="w-[40px] px-1.5 py-2.5">
                                <span className="sr-only">Pin</span>
                            </th>
                            <th className="w-[90px] px-2.5 py-2.5 text-left">
                                <SortHeader label="Task ID" sortKeyName="taskId" />
                            </th>
                            <th className="w-[280px] px-2.5 py-2.5 text-left">
                                <span className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">Task Name</span>
                            </th>
                            <th className="w-[140px] px-2.5 py-2.5 text-left">
                                <SortHeader label="Person" sortKeyName="person" />
                            </th>
                            <th className="w-[150px] px-2.5 py-2.5 text-left">
                                <SortHeader label="Status" sortKeyName="status" />
                            </th>
                            <th className="w-[130px] px-2.5 py-2.5 text-left">
                                <SortHeader label="Sprint Goal" sortKeyName="goal" />
                            </th>
                            <th className="w-[110px] px-2.5 py-2.5 text-left">
                                <SortHeader label="Risk" sortKeyName="risk" />
                            </th>
                            <th className="w-[70px] px-2.5 py-2.5 text-left">
                                <SortHeader label="Stale" sortKeyName="stale" />
                            </th>
                            <th className="w-[140px] px-2.5 py-2.5 text-left">
                                <SortHeader label="Blocked By" sortKeyName="blocking" />
                            </th>
                            <th className="w-[30px] px-1.5 py-2.5">
                                <span className="sr-only">Action</span>
                            </th>
                        </tr>
                    </thead>
                </table>

                {/* Table Body */}
                <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
                    <table className="w-full min-w-[1170px] table-fixed">
                        <tbody className="divide-y divide-border/40">
                            {tasks.map((task) => {
                                const isHR = highRiskIds.has(task.taskId);
                                const severity = getStatusSeverity(task.currentStatus);
                                const metGoal = hasMetSprintGoal(task.currentStatus, task.sprintGoal);

                                return (
                                    <tr
                                        key={task.taskId}
                                        onClick={() => onTaskClick(task.taskId)}
                                        className={`transition-all cursor-pointer group ${
                                            metGoal
                                                ? 'bg-emerald-50/50 dark:bg-emerald-950/10 hover:bg-emerald-100/50 dark:hover:bg-emerald-950/20 border-l-2 border-emerald-500'
                                                : isHR
                                                    ? 'bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-950/30 border-l-2 border-red-500'
                                                    : 'hover:bg-muted/50'
                                        }`}
                                    >
                                        {/* Pin */}
                                        <td className="w-[40px] px-1.5 py-2.5 align-top">
                                            <div className="flex justify-center pt-1">
                                                {isHR && <Pin className="w-3.5 h-3.5 text-red-500 fill-red-500" />}
                                            </div>
                                        </td>

                                        {/* Task ID */}
                                        <td className="w-[90px] px-2.5 py-2.5 align-top">
                                            <span className="font-mono text-[11px] text-muted-foreground font-bold break-all">{task.taskId}</span>
                                        </td>

                                        {/* Task Name */}
                                        <td className="w-[280px] px-2.5 py-2.5 align-top">
                                            <span className="text-xs text-foreground font-semibold break-words leading-relaxed group-hover:text-primary transition-colors">
                                                {task.taskName}
                                            </span>
                                        </td>

                                        {/* Person */}
                                        <td className="w-[140px] px-2.5 py-2.5 align-top">
                                            <span className="text-xs text-muted-foreground break-words font-bold font-mono uppercase tracking-tight opacity-80">{task.currentPerson || '—'}</span>
                                        </td>

                                        {/* Status */}
                                        <td className="w-[150px] px-2.5 py-2.5 align-top">
                                            <StatusBadge status={task.currentStatus} />
                                        </td>

                                        {/* Sprint Goal */}
                                        <td className="w-[130px] px-2.5 py-2.5 align-top">
                                            {task.sprintGoal ? (
                                                <div className="flex items-center gap-1.5">
                                                    {metGoal ? (
                                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-500 flex-shrink-0" />
                                                    ) : (
                                                        <Target className="w-3 h-3 text-muted-foreground/50 flex-shrink-0" />
                                                    )}
                                                    <span className={`text-[10px] font-bold font-mono break-words ${metGoal ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                                                        {task.sprintGoal}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-[10px] text-muted-foreground/30 font-bold font-mono">—</span>
                                            )}
                                        </td>

                                        {/* Risk */}
                                        <td className="w-[110px] px-2.5 py-2.5 align-top">
                                            {task.riskLevel === 'critical' ? (
                                                <Badge variant="destructive" className="gap-1 text-[9px] px-1.5 font-bold uppercase tracking-tight">
                                                    <RefreshCw className="w-2.5 h-2.5" />
                                                    DOOM ×{task.doomLoopCount || task.reprocessCount}
                                                </Badge>
                                            ) : task.riskLevel === 'elevated' ? (
                                                <Badge className="gap-1 text-[9px] px-1.5 bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-800 font-bold uppercase tracking-tight">
                                                    <AlertTriangle className="w-2.5 h-2.5" />
                                                    ELEVATED
                                                </Badge>
                                            ) : (
                                                <span className="text-[10px] text-muted-foreground/30 font-bold font-mono">—</span>
                                            )}
                                        </td>

                                        {/* Stale */}
                                        <td className="w-[70px] px-2.5 py-2.5 align-top">
                                            {task.isStale ? (
                                                <span className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-bold font-mono uppercase tracking-tight">
                                                    <Clock className="w-2.5 h-2.5" />
                                                    {Math.floor(task.staleDurationMs / 3600000)}h
                                                </span>
                                            ) : (
                                                <span className="text-[10px] text-muted-foreground/30 font-bold font-mono">—</span>
                                            )}
                                        </td>

                                        {/* Blocked By */}
                                        <td className="w-[140px] px-2.5 py-2.5 align-top">
                                            {task.blockedBy ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-[10px] text-red-700 font-bold dark:bg-red-950/50 dark:border-red-900/50 dark:text-red-300 uppercase tracking-tight">
                                                    <User className="w-2.5 h-2.5" />
                                                    {task.blockedBy}
                                                </span>
                                            ) : (
                                                <span className="text-[10px] text-muted-foreground/30 font-bold font-mono">—</span>
                                            )}
                                        </td>

                                        {/* Chevron indicator */}
                                        <td className="w-[30px] px-1.5 py-2.5 align-top">
                                            <div className="flex justify-center pt-1">
                                                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Summary Stats */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] uppercase font-black tracking-widest text-muted-foreground bg-secondary/30 px-4 py-2 rounded-lg border border-border/50 shadow-sm">
                <span className="flex items-center gap-1.5">Total: <span className="text-foreground font-mono">{stats.total}</span></span>
                <span className="opacity-20 text-foreground">|</span>
                <span className="flex items-center gap-1.5">High Risk: <span className="text-red-600 dark:text-red-400 font-mono">{stats.highRisk}</span></span>
                <span className="opacity-20 text-foreground">|</span>
                <span className="flex items-center gap-1.5">Stale: <span className="text-amber-600 dark:text-amber-400 font-mono">{stats.stale}</span></span>
                <span className="opacity-20 text-foreground">|</span>
                <span className="flex items-center gap-1.5">Blocked: <span className="text-red-600 dark:text-red-400 font-mono">{stats.blocked}</span></span>
                <span className="opacity-20 text-foreground">|</span>
                <span className="flex items-center gap-1.5">Met Goal: <span className="text-emerald-600 dark:text-emerald-400 font-mono">{stats.metGoal}</span></span>
            </div>
        </div>
    );
}
