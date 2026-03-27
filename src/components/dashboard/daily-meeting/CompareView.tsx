import React, { useMemo } from 'react';
import { TaskAnalysis, RawLogEvent } from '@/lib/types';
import { useDailyTodos } from '@/lib/hooks/useDailyTodos';
import { format, subDays } from 'date-fns';
import { PersonMeetingData } from './types';
import { priorityDotColor, StatusBadge } from '@/lib/status-utils';
import { TaskCard } from '../TaskCard';
import { Badge } from '../../ui/badge';
import {
    ArrowRight,
    Calendar,
    Check,
    CheckCircle2,
    ChevronRight,
    Circle,
    Hand,
    History,
    Lightbulb,
    Repeat,
    Sparkles,
    Target,
    TrendingUp,
} from 'lucide-react';

export interface CompareViewProps {
    personData: PersonMeetingData;
    analyses: Record<string, TaskAnalysis>;
    highRiskIds: Set<string>;
    onTaskClick: (taskId: string) => void;
    dailyTodos: ReturnType<typeof useDailyTodos>;
    rawLogs: RawLogEvent[];
}

export function CompareView({
    personData,
    analyses,
    highRiskIds,
    onTaskClick,
    dailyTodos,
    rawLogs,
}: CompareViewProps) {
    const today = new Date();
    const yesterday = subDays(today, 1);
    const todayStr = format(today, 'yyyy-MM-dd');
    const yesterdayStr = format(yesterday, 'yyyy-MM-dd');

    const todayTodos = dailyTodos.getTodosForPersonDate(personData.person, todayStr);
    const yesterdayTodos = dailyTodos.getTodosForPersonDate(personData.person, yesterdayStr);

    const yesterdayCompleted = yesterdayTodos.filter((t) => t.completedAt);
    const yesterdayIncomplete = yesterdayTodos.filter((t) => !t.completedAt);

    const todayTaskIds = new Set(todayTodos.map((t) => t.taskId));
    const carryOverTasks = yesterdayIncomplete.filter((t) => !todayTaskIds.has(t.taskId));

    const todayDateStr = format(today, 'yyyy-MM-dd');
    const systemDetectedActivity = useMemo(() => {
        const todayLogs = rawLogs.filter((log) => {
            const logDate = format(new Date(log.timestamp), 'yyyy-MM-dd');
            return logDate === todayDateStr && log.person.includes(personData.person);
        });
        const activeTaskIds = new Set(todayLogs.map((l) => l.taskId));
        return Array.from(activeTaskIds)
            .map((taskId) => analyses[taskId])
            .filter((t): t is TaskAnalysis => !!t && t.currentStatus !== 'Completed');
    }, [rawLogs, todayDateStr, personData.person, analyses]);

    const plannedTaskIds = new Set(todayTodos.map((t) => t.taskId));
    const blockingTaskIds = new Set(personData.categories.blockingOthers.map((t) => t.taskId));
    
    const unplannedActivity = useMemo(() => {
        const unplanned = systemDetectedActivity.filter((t) => !plannedTaskIds.has(t.taskId));
        return unplanned.sort((a, b) => {
            const aIsBlocking = blockingTaskIds.has(a.taskId) ? 1 : 0;
            const bIsBlocking = blockingTaskIds.has(b.taskId) ? 1 : 0;
            const aIsStale = a.isStale ? 1 : 0;
            const bIsStale = b.isStale ? 1 : 0;
            const aScore = aIsBlocking * 10 + aIsStale * 5;
            const bScore = bIsBlocking * 10 + bIsStale * 5;
            return bScore - aScore;
        });
    }, [systemDetectedActivity, plannedTaskIds, blockingTaskIds]);
    
    const plannedWithActivity = systemDetectedActivity.filter((t) => plannedTaskIds.has(t.taskId));

    const yesterdayCompletionRate = yesterdayTodos.length > 0
        ? Math.round((yesterdayCompleted.length / yesterdayTodos.length) * 100)
        : 0;

    const planningHints = useMemo(() => {
        const hints: { type: 'warning' | 'success' | 'info'; message: string; icon: React.ReactNode }[] = [];

        if (carryOverTasks.length > 0) {
            hints.push({
                type: 'warning',
                message: `${carryOverTasks.length} task${carryOverTasks.length > 1 ? 's' : ''} from yesterday not completed and not in today's plan`,
                icon: <Repeat className="w-3.5 h-3.5" />,
            });
        }

        if (yesterdayCompletionRate === 100 && yesterdayTodos.length > 0) {
            hints.push({
                type: 'success',
                message: 'Great job! You completed all planned tasks yesterday',
                icon: <CheckCircle2 className="w-3.5 h-3.5" />,
            });
        } else if (yesterdayCompletionRate < 50 && yesterdayTodos.length >= 3) {
            hints.push({
                type: 'warning',
                message: 'Consider planning fewer tasks - yesterday\'s completion rate was low',
                icon: <TrendingUp className="w-3.5 h-3.5" />,
            });
        }

        if (unplannedActivity.length > 0) {
            hints.push({
                type: 'info',
                message: `${unplannedActivity.length} unplanned task${unplannedActivity.length > 1 ? 's' : ''} detected with activity today`,
                icon: <Sparkles className="w-3.5 h-3.5" />,
            });
        }

        if (todayTodos.length === 0 && personData.allTasks.length > 0) {
            hints.push({
                type: 'info',
                message: 'No tasks planned for today yet',
                icon: <Calendar className="w-3.5 h-3.5" />,
            });
        }

        const blockingCount = personData.categories.blockingOthers.length;
        if (blockingCount > 0 && !todayTodos.some((t) => personData.categories.blockingOthers.some((bt) => bt.taskId === t.taskId))) {
            hints.push({
                type: 'warning',
                message: `You have ${blockingCount} blocking task${blockingCount > 1 ? 's' : ''} - consider adding to today's plan`,
                icon: <Hand className="w-3.5 h-3.5" />,
            });
        }

        return hints;
    }, [carryOverTasks, yesterdayCompletionRate, yesterdayTodos, unplannedActivity, todayTodos, personData]);

    return (
        <div className="space-y-6">
            {/* Planning Hints */}
            {planningHints.length > 0 && (
                <div className="rounded-2xl border border-border bg-secondary/30 p-5 shadow-sm">
                    <div className="flex items-center gap-2.5 mb-4 text-foreground">
                        <Lightbulb className="w-4 h-4 text-amber-500" />
                        <span className="font-black text-[10px] uppercase tracking-widest">Planning Insights</span>
                    </div>
                    <div className="space-y-2.5">
                        {planningHints.map((hint, idx) => (
                            <div
                                key={idx}
                                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold ${
                                    hint.type === 'warning'
                                        ? 'bg-amber-50 text-amber-700 border border-amber-200 shadow-sm dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/40'
                                        : hint.type === 'success'
                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40'
                                            : 'bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-sm dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/40'
                                }`}
                            >
                                <div className="p-1 rounded-lg bg-white/50 dark:bg-black/20">
                                    {hint.icon}
                                </div>
                                <span className="leading-relaxed">{hint.message}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Comparison Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Yesterday's Plan */}
                <div className="rounded-2xl border border-border bg-card/50 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-5 pb-4 border-b border-border/50">
                        <div className="flex items-center gap-2.5">
                            <div className="p-1.5 rounded-lg bg-secondary">
                                <History className="w-4 h-4 text-muted-foreground" />
                            </div>
                            <h3 className="font-black text-[10px] uppercase tracking-widest text-foreground">Yesterday's Plan</h3>
                        </div>
                        <div className="flex items-center gap-2">
                            {yesterdayTodos.length > 0 && (
                                <div className={`text-[9px] font-black uppercase tracking-tighter px-2 py-1 rounded-lg border ${
                                    yesterdayCompletionRate === 100
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400'
                                        : yesterdayCompletionRate >= 50
                                            ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400'
                                            : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400'
                                }`}>
                                    {yesterdayCompletionRate}% done
                                </div>
                            )}
                            <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-border/50 bg-secondary/30">
                                {yesterdayTodos.length} items
                            </Badge>
                        </div>
                    </div>

                    {yesterdayTodos.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/40 bg-secondary/20 rounded-xl border border-dashed border-border/50">
                            <Calendar className="w-8 h-8 mb-2 opacity-20" />
                            <p className="text-[10px] font-black uppercase tracking-widest">No previous plan</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Completed */}
                            {yesterdayCompleted.length > 0 && (
                                <div className="space-y-2.5">
                                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 px-1">
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        <span className="text-[9px] font-black uppercase tracking-[0.2em]">Completed ({yesterdayCompleted.length})</span>
                                    </div>
                                    <div className="space-y-2">
                                        {yesterdayCompleted.map((todoItem) => {
                                            const task = analyses[todoItem.taskId];
                                            if (!task) return null;
                                            const blockedByLabel =
                                                task.blockedBy && task.blockedBy !== personData.person
                                                    ? task.blockedBy
                                                    : undefined;
                                            return (
                                                <TaskCard
                                                    key={todoItem.taskId}
                                                    task={task}
                                                    isHighRisk={highRiskIds.has(task.taskId)}
                                                    onTaskClick={onTaskClick}
                                                    showSprintGoal={true}
                                                    todoCompleted={true}
                                                    blockedByLabel={blockedByLabel}
                                                />
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Incomplete */}
                            {yesterdayIncomplete.length > 0 && (
                                <div className="space-y-2.5">
                                    <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 px-1">
                                        <Circle className="w-3.5 h-3.5" />
                                        <span className="text-[9px] font-black uppercase tracking-[0.2em]">Not Completed ({yesterdayIncomplete.length})</span>
                                    </div>
                                    <div className="space-y-2">
                                        {yesterdayIncomplete.map((todoItem) => {
                                            const task = analyses[todoItem.taskId];
                                            const isCarryOver = carryOverTasks.some((c) => c.taskId === todoItem.taskId);
                                            const isAddedToToday = todayTaskIds.has(todoItem.taskId);
                                            if (!task) return null;
                                            const blockedByLabel =
                                                task.blockedBy && task.blockedBy !== personData.person
                                                    ? task.blockedBy
                                                    : undefined;
                                            return (
                                                <TaskCard
                                                    key={todoItem.taskId}
                                                    task={task}
                                                    isHighRisk={highRiskIds.has(task.taskId)}
                                                    onTaskClick={onTaskClick}
                                                    showSprintGoal={true}
                                                    blockedByLabel={blockedByLabel}
                                                    actions={
                                                        isCarryOver ? (
                                                            <div className="text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-md bg-amber-500 text-white shadow-sm flex items-center gap-1">
                                                                <Repeat className="w-2.5 h-2.5" />
                                                                Carry Over
                                                            </div>
                                                        ) : isAddedToToday ? (
                                                            <div className="text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-md bg-[#1D3557] text-white shadow-sm flex items-center gap-1">
                                                                <ArrowRight className="w-2.5 h-2.5" />
                                                                In plan
                                                            </div>
                                                        ) : null
                                                    }
                                                />
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Today's Plan + System Activity */}
                <div className="rounded-2xl border border-indigo-200/50 bg-indigo-50/20 p-5 shadow-sm dark:bg-indigo-950/10 dark:border-indigo-900/30">
                    <div className="flex items-center justify-between mb-5 pb-4 border-b border-indigo-200/30 dark:border-indigo-900/30">
                        <div className="flex items-center gap-2.5">
                            <div className="p-1.5 rounded-lg bg-indigo-600 shadow-lg shadow-indigo-600/20">
                                <Calendar className="w-4 h-4 text-white" />
                            </div>
                            <h3 className="font-black text-[10px] uppercase tracking-widest text-foreground">Today's Protocol</h3>
                        </div>
                        <div className="flex items-center gap-2">
                            {todayTodos.length > 0 && (
                                <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-indigo-300 text-indigo-700 bg-white/50 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800">
                                    {todayTodos.length} Objectives
                                </Badge>
                            )}
                        </div>
                    </div>

                    {todayTodos.length === 0 && unplannedActivity.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-indigo-400 opacity-30 bg-indigo-50/50 rounded-2xl border border-dashed border-indigo-200">
                            <Calendar className="w-12 h-12 mb-4" />
                            <p className="font-black text-[10px] uppercase tracking-[0.2em]">Awaiting Daily Plan</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Planned Tasks */}
                            {todayTodos.length > 0 && (
                                <div className="space-y-2">
                                    {todayTodos.map((todoItem) => {
                                        const task = analyses[todoItem.taskId];
                                        if (!task) return null;
                                        const hasActivity = plannedWithActivity.some((t) => t.taskId === task.taskId);
                                        const blockedByLabel =
                                            task.blockedBy && task.blockedBy !== personData.person
                                                ? task.blockedBy
                                                : undefined;
                                        return (
                                            <TaskCard
                                                key={todoItem.taskId}
                                                task={task}
                                                isHighRisk={highRiskIds.has(task.taskId)}
                                                onTaskClick={onTaskClick}
                                                showSprintGoal={true}
                                                isInTodoList={true}
                                                todoCompleted={!!todoItem.completedAt}
                                                blockedByLabel={blockedByLabel}
                                                actions={
                                                    hasActivity ? (
                                                        <div className="text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-md bg-emerald-600 text-white shadow-sm animate-pulse">
                                                            Active
                                                        </div>
                                                    ) : null
                                                }
                                            />
                                        );
                                    })}
                                </div>
                            )}

                            {/* Unplanned Activity */}
                            {unplannedActivity.length > 0 && (
                                <div className="space-y-3 pt-4 border-t border-indigo-200/30 dark:border-indigo-900/30">
                                    <div className="flex items-center gap-2 px-1">
                                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400">Field Activity Detected ({unplannedActivity.length})</span>
                                    </div>
                                    <div className="space-y-2">
                                        {unplannedActivity.map((task) => {
                                            const blockedByLabel =
                                                task.blockedBy && task.blockedBy !== personData.person
                                                    ? task.blockedBy
                                                    : undefined;
                                            return (
                                                <TaskCard
                                                    key={task.taskId}
                                                    task={task}
                                                    isHighRisk={highRiskIds.has(task.taskId)}
                                                    onTaskClick={onTaskClick}
                                                    showSprintGoal={true}
                                                    blockedByLabel={blockedByLabel}
                                                    actions={
                                                        <div className="text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-md bg-amber-500 text-white shadow-sm animate-pulse">
                                                            Detected
                                                        </div>
                                                    }
                                                />
                                            );
                                        })}
                                    </div>
                                    <div className="flex items-center gap-2 px-3 py-2 bg-amber-50/50 dark:bg-amber-950/20 rounded-lg border border-amber-100/50 dark:border-amber-900/30 shadow-inner">
                                        <div className="w-1 h-1 rounded-full bg-amber-500 animate-pulse" />
                                        <p className="text-[9px] text-amber-700/60 dark:text-amber-500/60 font-bold tracking-tight">
                                            Telemetry confirms active throughput on these unlisted items.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
