import React from 'react';
import { TaskAnalysis } from '@/lib/types';
import { useDailyTodos } from '@/lib/hooks/useDailyTodos';
import { format, isToday, isYesterday } from 'date-fns';
import { PersonMeetingData } from './types';
import { priorityDotColor, StatusBadge } from '@/lib/status-utils';
import { TaskCard } from '../TaskCard';
import { hasMetSprintGoal } from '@/lib/utils';
import {
    Calendar,
    Check,
    CheckCircle2,
    ChevronRight,
    History,
    Target,
} from 'lucide-react';

export interface HistoricalViewProps {
    personData: PersonMeetingData;
    analyses: Record<string, TaskAnalysis>;
    highRiskIds: Set<string>;
    onTaskClick: (taskId: string) => void;
    dailyTodos: ReturnType<typeof useDailyTodos>;
}

export function HistoricalView({
    personData,
    analyses,
    highRiskIds,
    onTaskClick,
    dailyTodos,
}: HistoricalViewProps) {
    const history = dailyTodos.getHistoricalTodos(personData.person, 14);
    const pastHistory = history.filter((entry) => !isToday(new Date(entry.date)));

    if (pastHistory.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground/30 bg-secondary/10 rounded-3xl border border-dashed border-border/50">
                <History className="w-12 h-12 mb-4 opacity-10" />
                <p className="text-xs font-bold text-muted-foreground/40 tracking-tight">Archive Empty</p>
                <p className="text-[10px] mt-2 font-medium text-muted-foreground/30">Historical deployments will be logged here.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {pastHistory.map((entry) => {
                const date = new Date(entry.date);
                const completed = entry.items.filter((i) => i.completedAt).length;
                const total = entry.items.length;
                
                return (
                    <div
                        key={entry.date}
                        className="rounded-2xl border border-border bg-card/50 p-5 shadow-sm overflow-hidden relative"
                    >
                        <div className="flex items-center justify-between mb-5 pb-4 border-b border-border/50">
                            <div className="flex items-center gap-3">
                                <div className="p-1.5 rounded-lg bg-secondary">
                                    <Calendar className="w-4 h-4 text-muted-foreground" />
                                </div>
                                <span className="font-bold text-sm tracking-tight text-foreground">
                                    {isYesterday(date) ? 'Yesterday' : format(date, 'EEEE, MMM d')}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className={`text-[10px] font-bold tracking-tight px-2.5 py-1 rounded-full border shadow-sm ${
                                    completed === total && total > 0
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50'
                                        : completed > 0
                                            ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/50'
                                            : 'bg-secondary text-muted-foreground border-border/50'
                                }`}>
                                    {completed}/{total} Objectives Met
                                </div>
                            </div>
                        </div>
                        <div className="space-y-2.5">
                            {entry.items.map((todoItem) => {
                                const task = analyses[todoItem.taskId];
                                if (!task) {
                                    return (
                                        <div
                                            key={todoItem.taskId}
                                            className="px-4 py-3 rounded-xl bg-secondary/40 border border-dashed border-border/50 flex items-center justify-between"
                                        >
                                            <span className="text-[11px] text-muted-foreground/40 font-bold tracking-tight font-mono">
                                                {todoItem.taskId}
                                            </span>
                                            <span className="text-[10px] font-medium text-muted-foreground/30">Archive instance purged from active memory</span>
                                        </div>
                                    );
                                }
                                const blockedByLabel = task.blockedBy && task.blockedBy !== personData.person ? task.blockedBy : undefined;
                                return (
                                    <TaskCard
                                        key={todoItem.taskId}
                                        task={task}
                                        isHighRisk={highRiskIds.has(task.taskId)}
                                        onTaskClick={onTaskClick}
                                        showSprintGoal={true}
                                        todoCompleted={!!todoItem.completedAt}
                                        blockedByLabel={blockedByLabel}
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
