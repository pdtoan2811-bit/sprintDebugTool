'use client';

import React from 'react';
import { PersonSummary, TaskAnalysis } from '@/lib/types';
import { isBottleneckStatus, getStatusSeverity } from '@/lib/workflow-engine';
import { Badge } from '../ui/badge';
import {
    AlertTriangle,
    ChevronRight,
    Clock,
    Copy,
    RefreshCw,
    Shield,
    Users,
} from 'lucide-react';
import { priorityDotColor, StatusBadge } from '@/lib/status-utils';
import { TaskCard } from './TaskCard';

interface PersonnelOverviewProps {
    summaries: PersonSummary[];
    highRiskIds: Set<string>;
    onTaskClick: (taskId: string) => void;
}

// ── Status Priority for sorting ──────────────────────────────────
// Reprocess > Waiting to Integrate > In Process > Not Started > others > Staging Passed
const STATUS_SORT_PRIORITY: Record<string, number> = {
    'Reprocess': 1,
    'Waiting to Integrate': 2,
    'In Process': 3,
    'Not Started': 4,
    // others default to 5
    'Staging Passed': 6,
    'Completed': 7,
};

function getStatusPriority(status: string): number {
    return STATUS_SORT_PRIORITY[status] ?? 5;
}

function sortTasks(tasks: TaskAnalysis[]): TaskAnalysis[] {
    return [...tasks].sort((a, b) => {
        // Primary: status priority (lower number = higher priority)
        const priorityDiff = getStatusPriority(a.currentStatus) - getStatusPriority(b.currentStatus);
        if (priorityDiff !== 0) return priorityDiff;
        // Secondary: stale hours descending (more stale = first)
        return b.staleDurationMs - a.staleDurationMs;
    });
}

// ── Status priority dot color ────────────────────────────────────
// ── Status priority dot color ────────────────────────────────────
// Note: priorityDotColor and StatusBadge are now imported from @/lib/status-utils

function formatStaleHours(ms: number): string {
    const hours = Math.floor(ms / 3600000);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}

/** Build readable DM text for one person's to-do list: title, recordLink, status, blockedBy, blocking others */
function formatPersonListForDM(summary: PersonSummary, allSummaries: PersonSummary[]): string {
    const lines: string[] = [
        `📋 ${summary.person} – To-do list`,
        '',
    ];
    // People who are blocked by this person (tasks where blockedBy === summary.person)
    const blockingOthers = [
        ...new Set(
            allSummaries.flatMap((s) => s.tasks).filter((t) => t.blockedBy === summary.person).map((t) => t.currentPerson)
        ),
    ].filter(Boolean);
    if (blockingOthers.length > 0) {
        lines.push(`Blocking: ${blockingOthers.join(', ')}`);
        lines.push('');
    }
    const sorted = sortTasks(summary.tasks);
    sorted.forEach((task, i) => {
        lines.push(`${i + 1}. ${task.taskName}`);
        if (task.recordLink) {
            lines.push(`   Link: ${task.recordLink}`);
        }
        lines.push(`   Status: ${task.currentStatus}`);
        if (task.blockedBy) {
            lines.push(`   Blocked by: ${task.blockedBy}`);
        }
        if (task.isStale && task.staleDurationMs > 0) {
            lines.push(`   ⏱ Stale: ${formatStaleHours(task.staleDurationMs)}`);
        }
        lines.push('');
    });
    return lines.join('\n').trimEnd();
}

// ── Sort person summaries by total stale hours desc, then critical task count desc ──
function sortSummaries(summaries: PersonSummary[]): PersonSummary[] {
    return [...summaries].sort((a, b) => {
        // Total stale duration descending
        const aTotalStale = a.tasks.reduce((sum, t) => sum + t.staleDurationMs, 0);
        const bTotalStale = b.tasks.reduce((sum, t) => sum + t.staleDurationMs, 0);
        if (bTotalStale !== aTotalStale) return bTotalStale - aTotalStale;
        // Critical task count descending
        const aCritical = a.tasks.filter((t) => t.riskLevel === 'critical' || getStatusPriority(t.currentStatus) <= 2).length;
        const bCritical = b.tasks.filter((t) => t.riskLevel === 'critical' || getStatusPriority(t.currentStatus) <= 2).length;
        return bCritical - aCritical;
    });
}

export function PersonnelOverview({ summaries, highRiskIds, onTaskClick }: PersonnelOverviewProps) {
    const [copiedPerson, setCopiedPerson] = React.useState<string | null>(null);

    const handleCopyForDM = React.useCallback((summary: PersonSummary) => {
        const text = formatPersonListForDM(summary, summaries);
        navigator.clipboard.writeText(text).then(() => {
            setCopiedPerson(summary.person);
            setTimeout(() => setCopiedPerson(null), 2000);
        });
    }, [summaries]);

    const sortedSummaries = sortSummaries(summaries);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {sortedSummaries.map((summary) => {
                const hasBlockers = summary.blockingTasks.length > 0;
                const hasCritical = summary.tasks.some((t) => t.riskLevel === 'critical');
                const sortedTasks = sortTasks(summary.tasks);
                const totalStaleMs = summary.tasks.reduce((sum, t) => sum + t.staleDurationMs, 0);
                const justCopied = copiedPerson === summary.person;

                return (
                    <div
                        key={summary.person}
                        className={`rounded-xl border p-3 transition-all shadow-sm ${hasCritical
                            ? 'border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/20 dark:shadow-[0_0_30px_rgba(239,68,68,0.1)]'
                            : hasBlockers
                                ? 'border-amber-200 bg-amber-50 dark:border-amber-700/40 dark:bg-amber-950/10'
                                : 'border-border bg-card'
                            }`}
                    >
                        {/* Person Header */}
                        <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-border/50">
                            <div className="flex items-center gap-2">
                                <div className={`w-2.5 h-2.5 rounded-full ${hasCritical ? 'bg-red-500 animate-pulse' : hasBlockers ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
                                    }`} />
                                <h3 className="font-bold text-foreground text-sm tracking-tight">{summary.person}</h3>
                                <button
                                    type="button"
                                    onClick={() => handleCopyForDM(summary)}
                                    className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-all active:scale-90"
                                    title="Copy to-do list for DM"
                                >
                                    {justCopied ? (
                                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">Copied!</span>
                                    ) : (
                                        <Copy className="w-3.5 h-3.5" />
                                    )}
                                </button>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-semibold">
                                <span>{summary.totalTasks} tasks</span>
                                {summary.blockingTasks.length > 0 && (
                                    <Badge variant="destructive" className="text-[9px] px-1.5 py-0 font-bold">
                                        {summary.blockingTasks.length} blocked
                                    </Badge>
                                )}
                                {totalStaleMs > 0 && (
                                    <span className="flex items-center gap-0.5 text-amber-600 dark:text-amber-400">
                                        <Clock className="w-2.5 h-2.5" />
                                        {formatStaleHours(totalStaleMs)}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Priority Suggestion (Use Case 3) */}
                        {summary.suggestion && (
                            <div className="mb-2.5 px-2.5 py-1.5 rounded-lg bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-950/50 dark:border-amber-800/50 dark:text-amber-200 text-[11px] flex items-start gap-2 font-medium">
                                <Shield className="w-3 h-3 flex-shrink-0 mt-0.5" />
                                <span>{summary.suggestion}</span>
                            </div>
                        )}

                        {/* Task List - sorted by status priority then stale hours */}
                        <div className="space-y-1.5">
                            {sortedTasks.map((task) => {
                                return (
                                    <TaskCard
                                        key={task.taskId}
                                        task={task}
                                        isHighRisk={highRiskIds.has(task.taskId)}
                                        onTaskClick={onTaskClick}
                                        blockedByLabel={task.blockedBy || undefined}
                                        showMetadata={false}
                                    />
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
