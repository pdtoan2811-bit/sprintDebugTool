'use client';

import React, { useState, useMemo } from 'react';
import { RawLogEvent, TaskMovement, PersonDailyMovement, WORKFLOW_STATUSES, DailyMovementSummary } from '@/lib/types';
import { useDailyMovement } from '@/lib/hooks/useDailyMovement';
import { Badge } from '../ui/badge';
import { format, subDays, isToday, isYesterday, isBefore, startOfDay } from 'date-fns';
import { useRoles, ROLE_ORDER, ValidRole } from '@/lib/hooks/useRoles';
import { useDailyTodos } from '@/lib/hooks/useDailyTodos';
import {
    Activity,
    AlertTriangle,
    ArrowDown,
    ArrowRight,
    ArrowUp,
    Calendar,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Clock,
    Minus,
    Sparkles,
    TrendingDown,
    TrendingUp,
    User,
    Users,
    Zap,
} from 'lucide-react';

interface DailyRecapViewProps {
    rawLogs: RawLogEvent[];
    sprintStartDate?: string;
    onTaskClick: (taskId: string) => void;
}

import { StatusBadge } from '@/lib/status-utils';

function MovementStatusBadge({ status }: { status: string | null }) {
    if (!status) {
        return (
            <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-mono font-semibold bg-muted text-muted-foreground border-border">
                N/A
            </span>
        );
    }
    return <StatusBadge status={status} />;
}


function MovementArrow({ type }: { type: 'forward' | 'backward' | 'same' | 'new' }) {
    switch (type) {
        case 'forward':
        case 'new':
            return <ArrowRight className="w-3 h-3 text-emerald-600 dark:text-emerald-400 mx-1 flex-shrink-0" />;
        case 'backward':
            return <ArrowRight className="w-3 h-3 text-red-600 dark:text-red-400 mx-1 flex-shrink-0" />;
        case 'same':
            return <ArrowRight className="w-3 h-3 text-muted-foreground mx-1 flex-shrink-0" />;
    }
}

function StatusChainDisplay({ movement }: { movement: TaskMovement }) {
    const isRegression = movement.movementType === 'backward';
    const { statusChain, isNewTask } = movement;

    if (statusChain.length === 0) {
        return (
            <div className="flex items-center flex-wrap gap-1">
                <MovementStatusBadge status={movement.endStatus} />
            </div>
        );
    }

    if (statusChain.length === 1 && isNewTask) {
        return (
            <div className="flex items-center flex-wrap gap-1">
                <MovementStatusBadge status={statusChain[0].status} />
                <span className="text-[9px] text-muted-foreground ml-1">(created)</span>
            </div>
        );
    }

    return (
        <div className="flex items-center flex-wrap gap-0.5">
            {!isNewTask && movement.startStatus && (
                <>
                    <MovementStatusBadge status={movement.startStatus} />
                    {statusChain.length > 0 && (
                        <MovementArrow type={isRegression ? 'backward' : 'forward'} />
                    )}
                </>
            )}
            {statusChain.map((transition, idx) => (
                <React.Fragment key={`${transition.status}-${idx}`}>
                    <MovementStatusBadge status={transition.status} />
                    {idx < statusChain.length - 1 && (
                        <MovementArrow type={isRegression ? 'backward' : 'forward'} />
                    )}
                </React.Fragment>
            ))}
            {isRegression && (
                <Badge variant="destructive" className="ml-2 text-[9px] gap-1 bg-red-100 text-red-700 border-red-200 dark:bg-red-900/50 dark:text-red-300 dark:border-red-800">
                    <AlertTriangle className="w-2.5 h-2.5" />
                    Regression
                </Badge>
            )}
        </div>
    );
}

interface TaskMovementCardProps {
    movement: TaskMovement;
    onTaskClick: (taskId: string) => void;
    showMovementType?: boolean;
}

function TaskMovementCard({ movement, onTaskClick, showMovementType = true }: TaskMovementCardProps) {
    const isRegression = movement.movementType === 'backward';

    return (
        <button
            onClick={() => onTaskClick(movement.taskId)}
            className={`w-full text-left rounded-md border px-3 py-2 transition-all group cursor-pointer shadow-sm ${
                isRegression
                    ? 'border-red-200 bg-red-50/50 hover:border-red-300 dark:border-red-700/50 dark:bg-red-950/20 dark:hover:border-red-600/70 dark:hover:bg-red-950/30'
                    : 'border-border bg-card hover:bg-muted dark:border-zinc-800/50 dark:bg-zinc-900/30 dark:hover:border-zinc-700/70 dark:hover:bg-zinc-800/50'
            }`}
        >
            <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="font-mono text-[10px] text-muted-foreground flex-shrink-0">
                        {movement.taskId}
                    </span>
                    <span className="text-xs font-semibold text-foreground truncate">
                        {movement.taskName}
                    </span>
                </div>
                <ChevronRight className="w-3 h-3 text-muted-foreground/40 group-hover:text-foreground transition-colors flex-shrink-0" />
            </div>

            {showMovementType && <StatusChainDisplay movement={movement} />}

            <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                    <Activity className="w-2.5 h-2.5" />
                    {movement.eventCount} event{movement.eventCount !== 1 ? 's' : ''}
                </span>
                {movement.lastEventTime && (
                    <span className="flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        Last: {format(new Date(movement.lastEventTime), 'HH:mm')}
                    </span>
                )}
            </div>
        </button>
    );
}


interface PersonCardProps {
    personData: PersonDailyMovement;
    onTaskClick: (taskId: string) => void;
    defaultExpanded?: boolean;
}

function PersonCard({ personData, onTaskClick, defaultExpanded = false }: PersonCardProps) {
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        forward: defaultExpanded || personData.movedForward.length > 0,
        backward: defaultExpanded || personData.movedBackward.length > 0,
        same: defaultExpanded && personData.sameWithEvents.length > 0,
        noChange: false,
    });

    const toggleSection = (section: string) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const hasBackward = personData.movedBackward.length > 0;
    const hasForward = personData.movedForward.length > 0;
    const hasSame = personData.sameWithEvents.length > 0;
    const hasNoChange = personData.noChange.length > 0;

    const personStatus = hasBackward
        ? 'regression'
        : hasForward
            ? 'progress'
            : hasSame
                ? 'activity'
                : 'stalled';

    const borderColor = {
        regression: 'border-red-200 dark:border-red-700/60',
        progress: 'border-emerald-200 dark:border-emerald-700/60',
        activity: 'border-amber-200 dark:border-amber-700/60',
        stalled: 'border-border',
    }[personStatus];

    const bgColor = {
        regression: 'bg-red-50/30 dark:bg-red-950/10',
        progress: 'bg-emerald-50/30 dark:bg-emerald-950/10',
        activity: 'bg-amber-50/30 dark:bg-amber-950/10',
        stalled: 'bg-card',
    }[personStatus];

    const dotColor = {
        regression: 'bg-red-500 animate-pulse ring-2 ring-red-100 dark:ring-red-900/50',
        progress: 'bg-emerald-500 ring-2 ring-emerald-100 dark:ring-emerald-900/50',
        activity: 'bg-amber-500 ring-2 ring-amber-100 dark:ring-amber-900/50',
        stalled: 'bg-zinc-300 dark:bg-zinc-600',
    }[personStatus];

    return (
        <div className={`rounded-lg border p-3 transition-all shadow-sm ${borderColor} ${bgColor}`}>
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-border">
                <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${dotColor}`} />
                    <h3 className="font-semibold text-foreground">{personData.person}</h3>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-mono flex-wrap">
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800/50 gap-1">
                        <Zap className="w-2.5 h-2.5" />
                        {personData.totalEventsOnDay} events
                    </Badge>
                    {personData.forwardCount > 0 && (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/50 gap-1">
                            <TrendingUp className="w-2.5 h-2.5" />
                            {personData.forwardCount} forward
                        </Badge>
                    )}
                    {personData.backwardCount > 0 && (
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800/50 gap-1">
                            <TrendingDown className="w-2.5 h-2.5" />
                            {personData.backwardCount} backward
                        </Badge>
                    )}
                    {personData.sameWithEvents.length > 0 && (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/50 gap-1">
                            <Activity className="w-2.5 h-2.5" />
                            {personData.sameWithEvents.length} activity
                        </Badge>
                    )}
                    {personData.noChange.length > 0 && (
                        <Badge variant="outline" className="bg-muted text-muted-foreground border-border">
                            {personData.noChange.length} unchanged
                        </Badge>
                    )}
                </div>
            </div>

            <div className="space-y-2">
                {/* Moved Forward Section */}
                {hasForward && (
                    <div>
                        <button
                            onClick={() => toggleSection('forward')}
                            className="flex items-center gap-2 mb-2 text-emerald-700 dark:text-emerald-400 hover:opacity-80 transition-opacity w-full"
                        >
                            {expandedSections.forward ? (
                                <ChevronDown className="w-3.5 h-3.5" />
                            ) : (
                                <ChevronRight className="w-3.5 h-3.5" />
                            )}
                            <TrendingUp className="w-3.5 h-3.5" />
                            <span className="text-[11px] font-bold uppercase tracking-wider">
                                Moved Forward ({personData.movedForward.length})
                            </span>
                        </button>
                        {expandedSections.forward && (
                            <div className="space-y-1 ml-4">
                                {personData.movedForward.map(tm => (
                                    <TaskMovementCard
                                        key={tm.taskId}
                                        movement={tm}
                                        onTaskClick={onTaskClick}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Moved Backward Section */}
                {hasBackward && (
                    <div>
                        <button
                            onClick={() => toggleSection('backward')}
                            className="flex items-center gap-2 mb-2 text-red-700 dark:text-red-400 hover:opacity-80 transition-opacity w-full"
                        >
                            {expandedSections.backward ? (
                                <ChevronDown className="w-3.5 h-3.5" />
                            ) : (
                                <ChevronRight className="w-3.5 h-3.5" />
                            )}
                            <TrendingDown className="w-3.5 h-3.5" />
                            <span className="text-[11px] font-bold uppercase tracking-wider">
                                Moved Backward ({personData.movedBackward.length})
                            </span>
                        </button>
                        {expandedSections.backward && (
                            <div className="space-y-1 ml-4">
                                {personData.movedBackward.map(tm => (
                                    <TaskMovementCard
                                        key={tm.taskId}
                                        movement={tm}
                                        onTaskClick={onTaskClick}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Same With Events Section */}
                {hasSame && (
                    <div>
                        <button
                            onClick={() => toggleSection('same')}
                            className="flex items-center gap-2 mb-2 text-amber-700 dark:text-amber-400 hover:opacity-80 transition-opacity w-full"
                        >
                            {expandedSections.same ? (
                                <ChevronDown className="w-3.5 h-3.5" />
                            ) : (
                                <ChevronRight className="w-3.5 h-3.5" />
                            )}
                            <Activity className="w-3.5 h-3.5" />
                            <span className="text-[11px] font-bold uppercase tracking-wider">
                                Activity, Same Status ({personData.sameWithEvents.length})
                            </span>
                        </button>
                        {expandedSections.same && (
                            <div className="space-y-1 ml-4">
                                {personData.sameWithEvents.map(tm => (
                                    <TaskMovementCard
                                        key={tm.taskId}
                                        movement={tm}
                                        onTaskClick={onTaskClick}
                                        showMovementType={false}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* No Change Section */}
                {hasNoChange && (
                    <div>
                        <button
                            onClick={() => toggleSection('noChange')}
                            className="flex items-center gap-2 mb-2 text-muted-foreground hover:text-foreground transition-colors w-full"
                        >
                            {expandedSections.noChange ? (
                                <ChevronDown className="w-3.5 h-3.5" />
                            ) : (
                                <ChevronRight className="w-3.5 h-3.5" />
                            )}
                            <Minus className="w-3.5 h-3.5" />
                            <span className="text-[11px] font-bold uppercase tracking-wider">
                                No Change ({personData.noChange.length})
                            </span>
                        </button>
                        {expandedSections.noChange && (
                            <div className="space-y-1 ml-4">
                                {personData.noChange.map(tm => (
                                    <div
                                        key={tm.taskId}
                                        onClick={() => onTaskClick(tm.taskId)}
                                        className="w-full text-left rounded-lg border px-3 py-2 cursor-pointer border-border bg-muted/20 hover:bg-muted/50 transition-colors group"
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                                <span className="font-mono text-[10px] text-muted-foreground flex-shrink-0">
                                                    {tm.taskId}
                                                </span>
                                                <span className="text-xs text-muted-foreground font-medium group-hover:text-foreground transition-colors truncate">
                                                    {tm.taskName}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <MovementStatusBadge status={tm.endStatus} />
                                                <ChevronRight className="w-3 h-3 text-muted-foreground/30 group-hover:text-foreground transition-colors flex-shrink-0" />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}


interface SquadTodoRow {
    movement: TaskMovement;
    people: string[];
}

interface SquadSharedTasksTableProps {
    rows: SquadTodoRow[];
    onTaskClick: (taskId: string) => void;
}

function SquadSharedTasksTable({ rows, onTaskClick }: SquadSharedTasksTableProps) {
    const sortedRows = [...rows].sort((a, b) => {
        const order: Record<string, number> = { forward: 0, same: 1, 'no-change': 2, backward: 3, new: 4 };
        return (order[a.movement.movementType] ?? 99) - (order[b.movement.movementType] ?? 99);
    });

    if (sortedRows.length === 0) {
        return (
            <div className="text-center py-12 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p className="font-medium text-foreground">No shared squad tasks for this day.</p>
                <p className="text-sm mt-1">
                    We only list tasks that all selected people touched today.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-sm font-semibold text-foreground mb-0.5">
                        Today&apos;s shared squad tasks
                    </h2>
                    <p className="text-[11px] text-muted-foreground">
                        Each row is a task that all selected people worked on today.
                    </p>
                </div>
                <Badge variant="outline" className="bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-700/60 dark:text-indigo-200 text-[10px] px-2 py-1">
                    {sortedRows.length} shared task{sortedRows.length !== 1 ? 's' : ''}
                </Badge>
            </div>

            <div className="overflow-x-auto border border-border rounded-lg bg-card shadow-sm">
                <table className="w-full min-w-[720px] text-xs">
                    <thead className="bg-muted/50 border-b border-border">
                        <tr>
                            <th className="px-3 py-2 text-left text-[11px] font-bold tracking-tight text-muted-foreground">
                                Task
                            </th>
                            <th className="px-3 py-2 text-left text-[11px] font-bold tracking-tight text-muted-foreground">
                                People on this task
                            </th>
                            <th className="px-3 py-2 text-left text-[11px] font-bold tracking-tight text-muted-foreground">
                                Movement today
                            </th>
                            <th className="px-3 py-2 text-left text-[11px] font-bold tracking-tight text-muted-foreground w-[90px]">
                                Events
                            </th>
                            <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground w-[36px]">
                                {/* chevron */}
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {sortedRows.map(row => {
                            const tm = row.movement;
                            const people = row.people;
                            const isForward = tm.movementType === 'forward';
                            const isBackward = tm.movementType === 'backward';
                            const isSame = tm.movementType === 'same';
                            const isNoChange = tm.movementType === 'no-change';

                            const movementLabel = isForward
                                ? 'Moved forward'
                                : isBackward
                                    ? 'Regressed'
                                    : isSame
                                        ? 'Activity, same status'
                                        : isNoChange
                                            ? 'No movement'
                                            : 'New task';

                            const movementColor = isForward
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : isBackward
                                    ? 'text-red-600 dark:text-red-400'
                                    : isSame
                                        ? 'text-amber-600 dark:text-amber-400'
                                        : 'text-muted-foreground';

                            return (
                                <tr
                                    key={tm.taskId}
                                    onClick={() => onTaskClick(tm.taskId)}
                                    className="hover:bg-muted/50 cursor-pointer transition-colors"
                                >
                                    <td className="px-3 py-2 align-top">
                                        <div className="flex flex-col gap-0.5">
                                            <span className="font-mono text-[11px] text-muted-foreground">
                                                {tm.taskId}
                                            </span>
                                            <span className="text-xs text-foreground font-medium line-clamp-2">
                                                {tm.taskName}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-3 py-2 align-top">
                                        <div className="flex flex-wrap gap-1">
                                            {people.map(p => (
                                                <span
                                                    key={p}
                                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary border border-border text-[11px] text-foreground font-medium"
                                                >
                                                    <User className="w-3 h-3 text-muted-foreground" />
                                                    {p}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-3 py-2 align-top">
                                        <div className="flex flex-col gap-0.5">
                                            <span className={`text-[11px] font-bold ${movementColor}`}>
                                                {movementLabel}
                                            </span>
                                            <StatusChainDisplay movement={tm} />
                                        </div>
                                    </td>
                                    <td className="px-3 py-2 align-top">
                                        <div className="flex flex-col gap-0.5 text-[11px] text-muted-foreground">
                                            <span className="font-medium text-foreground/80">{tm.eventCount} event{tm.eventCount !== 1 ? 's' : ''}</span>
                                            {tm.lastEventTime && (
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    Last: {format(new Date(tm.lastEventTime), 'HH:mm')}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-3 py-2 align-top">
                                        <div className="flex justify-center pt-2">
                                            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40" />
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}


export function DailyRecapView({ rawLogs, sprintStartDate, onTaskClick }: DailyRecapViewProps) {
    const [selectedDate, setSelectedDate] = useState<Date>(() => subDays(new Date(), 1));
    const [selectedPersonsFilter, setSelectedPersonsFilter] = useState<Set<string>>(new Set());
    const [viewMode, setViewMode] = useState<'recap' | 'squad'>('recap');
    const { roles } = useRoles();
    const { getTodosForPersonDate } = useDailyTodos();

    const movementData = useDailyMovement(rawLogs, selectedDate);

    const filteredMovementData = useMemo(() => {
        if (selectedPersonsFilter.size === 0) {
            return movementData;
        }

        const filteredPersons = movementData.personMovements.filter((p: PersonDailyMovement) => selectedPersonsFilter.has(p.person));

        const distinctForward = new Set<string>();
        const distinctBackward = new Set<string>();
        const distinctSame = new Set<string>();
        const distinctNoChange = new Set<string>();

        filteredPersons.forEach((p: PersonDailyMovement) => {
            p.movedForward.forEach((tm: TaskMovement) => distinctForward.add(tm.taskId));
            p.movedBackward.forEach((tm: TaskMovement) => distinctBackward.add(tm.taskId));
            p.sameWithEvents.forEach((tm: TaskMovement) => distinctSame.add(tm.taskId));
            p.noChange.forEach((tm: TaskMovement) => distinctNoChange.add(tm.taskId));
        });

        let topMover: string | null = null;
        let maxForward = 0;
        filteredPersons.forEach((p: PersonDailyMovement) => {
            if (p.forwardCount > maxForward) {
                maxForward = p.forwardCount;
                topMover = p.person;
            }
        });

        // Compute Shared Tasks: tasks touched by >= 2 distinct persons in the selected filter
        const taskPersonCounts: Record<string, Set<string>> = {};
        const allFilteredTaskMovements: Record<string, TaskMovement> = {};

        filteredPersons.forEach((p: PersonDailyMovement) => {
            const allTasksForPerson = [
                ...p.movedForward,
                ...p.movedBackward,
                ...p.sameWithEvents,
                ...p.noChange,
            ];

            allTasksForPerson.forEach((tm: TaskMovement) => {
                if (!taskPersonCounts[tm.taskId]) {
                    taskPersonCounts[tm.taskId] = new Set();
                }
                taskPersonCounts[tm.taskId].add(p.person);
                // Keep one reference of the movement object for rendering
                allFilteredTaskMovements[tm.taskId] = tm;
            });
        });

        const sharedTaskIds = Object.keys(taskPersonCounts).filter((taskId: string) => taskPersonCounts[taskId].size === selectedPersonsFilter.size);
        
        const sharedSquadData: PersonDailyMovement | null = sharedTaskIds.length > 0 && selectedPersonsFilter.size > 1 ? {
            person: 'Shared Squad Progress',
            movedForward: [],
            movedBackward: [],
            sameWithEvents: [],
            noChange: [],
            totalTasks: sharedTaskIds.length,
            forwardCount: 0,
            backwardCount: 0,
            totalEventsOnDay: 0,
            urgencyScore: 0,
        } : null;

        if (sharedSquadData) {
            sharedTaskIds.forEach(taskId => {
                const tm = allFilteredTaskMovements[taskId];
                sharedSquadData.totalEventsOnDay += tm.eventCount;

                switch (tm.movementType) {
                    case 'forward':
                        sharedSquadData.movedForward.push(tm);
                        sharedSquadData.forwardCount++;
                        break;
                    case 'backward':
                        sharedSquadData.movedBackward.push(tm);
                        sharedSquadData.backwardCount++;
                        break;
                    case 'same':
                        sharedSquadData.sameWithEvents.push(tm);
                        break;
                    case 'no-change':
                        sharedSquadData.noChange.push(tm);
                        break;
                }
            });
        }

        // Return augmented object
        return {
            ...movementData,
            totalForward: distinctForward.size,
            totalBackward: distinctBackward.size,
            totalSameWithEvents: distinctSame.size,
            totalNoChange: distinctNoChange.size,
            totalTasksWithMovement: new Set([
                ...distinctForward,
                ...distinctBackward,
                ...distinctSame,
            ]).size,
            topMover,
            personMovements: filteredPersons,
            sharedSquadData: sharedSquadData,
        } as DailyMovementSummary & { sharedSquadData: PersonDailyMovement | null };
    }, [movementData, selectedPersonsFilter]);

    const sortedAllPersons = useMemo(() => {
        const persons = movementData.personMovements.map((p: PersonDailyMovement) => p.person);
        return persons.sort((a: string, b: string) => {
            const roleA = roles[a] || 'Other';
            const roleB = roles[b] || 'Other';
            const indexA = ROLE_ORDER.indexOf(roleA as ValidRole);
            const indexB = ROLE_ORDER.indexOf(roleB as ValidRole);
            const posA = indexA === -1 ? 99 : indexA;
            const posB = indexB === -1 ? 99 : indexB;
            if (posA !== posB) return posA - posB;
            return a.localeCompare(b);
        });
    }, [movementData.personMovements, roles]);

    const canGoBack = useMemo(() => {
        if (!sprintStartDate) return true;
        const sprintStart = startOfDay(new Date(sprintStartDate));
        return isBefore(sprintStart, startOfDay(selectedDate));
    }, [selectedDate, sprintStartDate]);

    const canGoForward = !isToday(selectedDate);

    const navigateDate = (direction: 'prev' | 'next') => {
        setSelectedDate(prev => {
            const newDate = new Date(prev);
            newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
            if (direction === 'next' && isToday(newDate)) return new Date();
            if (direction === 'next' && newDate > new Date()) return prev;
            if (direction === 'prev' && sprintStartDate && isBefore(newDate, new Date(sprintStartDate))) {
                return prev;
            }
            return newDate;
        });
    };

    const quickDateOptions = [
        { label: 'Yesterday', date: subDays(new Date(), 1), active: isYesterday(selectedDate) },
        { label: '2 days ago', date: subDays(new Date(), 2), active: false },
        { label: '3 days ago', date: subDays(new Date(), 3), active: false },
    ];

    const getDateLabel = () => {
        if (isToday(selectedDate)) return 'Today';
        if (isYesterday(selectedDate)) return 'Yesterday';
        return format(selectedDate, 'EEEE, MMM d');
    };

    return (
        <div className="space-y-4">
            {/* Control Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-border">
                {/* Day Selector */}
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center rounded-md border border-border bg-secondary p-0.5 shadow-sm">
                        <button
                            onClick={() => navigateDate('prev')}
                            disabled={!canGoBack}
                            className="p-1.5 rounded-md hover:bg-background text-muted-foreground hover:text-foreground transition-all disabled:opacity-20 disabled:cursor-not-allowed"
                            title="Previous day"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <div className="flex items-center gap-1.5 px-3 py-0.5 group select-none">
                            <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform" />
                            <span className="text-sm font-bold text-foreground min-w-[140px] text-center tracking-tight">
                                {getDateLabel()}
                            </span>
                        </div>
                        <button
                            onClick={() => navigateDate('next')}
                            disabled={!canGoForward}
                            className="p-1.5 rounded-md hover:bg-background text-muted-foreground hover:text-foreground transition-all disabled:opacity-20 disabled:cursor-not-allowed"
                            title="Next day"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Quick Date Options */}
                    <div className="flex items-center gap-1.5">
                        {quickDateOptions.map(opt => (
                            <button
                                key={opt.label}
                                onClick={() => setSelectedDate(opt.date)}
                                className={`px-3 py-1.5 text-xs rounded-md transition-all font-semibold ${
                                    format(selectedDate, 'yyyy-MM-dd') === format(opt.date, 'yyyy-MM-dd')
                                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-200 dark:shadow-blue-900/40'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary border border-transparent hover:border-border'
                                }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex flex-col gap-2 items-start md:items-end">
                    {/* Summary Stats */}
                    <div className="flex items-center gap-3 text-[10px] font-bold tracking-tight">
                        <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                            <TrendingUp className="w-3 h-3" />
                            <span className="font-mono">{filteredMovementData.totalForward} forward</span>
                        </div>
                        <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
                            <TrendingDown className="w-3 h-3" />
                            <span className="font-mono">{filteredMovementData.totalBackward} backward</span>
                        </div>
                        <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                            <Activity className="w-3 h-3" />
                            <span className="font-mono">{filteredMovementData.totalSameWithEvents} same</span>
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                            <Minus className="w-3 h-3" />
                            <span className="font-mono">{filteredMovementData.totalNoChange} unchanged</span>
                        </div>
                        {filteredMovementData.topMover && (
                            <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400 border-l border-border pl-3 ml-1">
                                <User className="w-3 h-3" />
                                <span className="font-mono">Top: {filteredMovementData.topMover}</span>
                            </div>
                        )}
                    </div>

                    {/* View Mode Toggle */}
                    <div className="inline-flex items-center rounded-md bg-secondary border border-border p-0.5 shadow-sm">
                        <button
                            onClick={() => setViewMode('recap')}
                            className={`px-3 py-1 rounded-md font-bold text-[11px] tracking-tight transition-all ${
                                viewMode === 'recap'
                                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-200 dark:shadow-blue-900/40'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-background'
                            }`}
                        >
                            Daily Recap
                        </button>
                        <button
                            onClick={() => setViewMode('squad')}
                            className={`px-3 py-1 rounded-md font-bold text-[11px] tracking-tight transition-all ${
                                viewMode === 'squad'
                                    ? 'bg-[#1D3557] text-white shadow-sm shadow-indigo-200 dark:shadow-indigo-900/40'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-background'
                            }`}
                        >
                            Squad Shared To‑Do
                        </button>
                    </div>
                </div>
            </div>

            {/* Personnel Selector Row */}
            {movementData.personMovements.length > 0 && (
                <div className="bg-secondary/30 p-4 rounded-xl border border-border flex flex-col gap-3 flex-shrink-0 shadow-sm">
                    <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-[#1D3557] dark:text-indigo-400" />
                        <span className="font-bold text-foreground text-sm tracking-tight">
                            Filter by Squad Members
                        </span>
                    </div>
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
                        {sortedAllPersons.map((person: string) => {
                            const isSelected = selectedPersonsFilter.has(person);
                            return (
                                <button
                                    key={person}
                                    onClick={() => {
                                        const next = new Set(selectedPersonsFilter);
                                        if (isSelected) next.delete(person);
                                        else next.add(person);
                                        setSelectedPersonsFilter(next);
                                    }}
                                    className={`flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all shadow-sm ${
                                        isSelected 
                                            ? 'bg-[#1D3557] border-[#1D3557] text-white shadow-indigo-200 dark:shadow-indigo-900/40'
                                            : 'bg-card border-border text-muted-foreground hover:bg-muted hover:text-foreground hover:border-muted-foreground/30'
                                    }`}
                                >
                                    <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white/80' : 'bg-muted-foreground/30'}`} />
                                    <span className="text-xs font-semibold">{person}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Summary Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className={`px-4 py-3 rounded-xl flex flex-col border transition-all shadow-sm ${
                    filteredMovementData.totalTasksWithMovement > 0 ? 'bg-blue-50/50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800/50' : 'bg-card border-border'
                }`}>
                    <span className="text-muted-foreground text-[10px] font-bold flex items-center gap-1 tracking-tight">
                        <Zap className="w-3 h-3 text-blue-600 dark:text-blue-400" /> Total Activity
                    </span>
                    <span className={`text-2xl font-bold font-mono mt-1 ${filteredMovementData.totalTasksWithMovement > 0 ? 'text-blue-700 dark:text-blue-300' : 'text-foreground'}`}>
                        {filteredMovementData.totalTasksWithMovement}
                    </span>
                </div>
                <div className={`px-4 py-3 rounded-xl flex flex-col border transition-all shadow-sm ${
                    filteredMovementData.totalForward > 0 ? 'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800/50' : 'bg-card border-border'
                }`}>
                    <span className="text-muted-foreground text-[10px] font-bold flex items-center gap-1 tracking-tight">
                        <TrendingUp className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> Forward
                    </span>
                    <span className={`text-2xl font-bold font-mono mt-1 ${filteredMovementData.totalForward > 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-foreground'}`}>
                        {filteredMovementData.totalForward}
                    </span>
                </div>
                <div className={`px-4 py-3 rounded-xl flex flex-col border transition-all shadow-sm ${
                    filteredMovementData.totalBackward > 0 ? 'bg-red-50/50 border-red-200 dark:bg-red-950/20 dark:border-red-800/50' : 'bg-card border-border'
                }`}>
                    <span className="text-muted-foreground text-[10px] font-bold flex items-center gap-1 tracking-tight">
                        <TrendingDown className="w-3 h-3 text-red-600 dark:text-red-400" /> Backward
                    </span>
                    <span className={`text-2xl font-bold font-mono mt-1 ${filteredMovementData.totalBackward > 0 ? 'text-red-700 dark:text-red-300' : 'text-foreground'}`}>
                        {filteredMovementData.totalBackward}
                    </span>
                </div>
                <div className={`px-4 py-3 rounded-xl flex flex-col border transition-all shadow-sm ${
                    filteredMovementData.totalSameWithEvents > 0 ? 'bg-amber-50/50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800/50' : 'bg-card border-border'
                }`}>
                    <span className="text-muted-foreground text-[10px] font-bold flex items-center gap-1 tracking-tight">
                        <Activity className="w-3 h-3 text-amber-600 dark:text-amber-400" /> Same Status
                    </span>
                    <span className={`text-2xl font-bold font-mono mt-1 ${filteredMovementData.totalSameWithEvents > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-foreground'}`}>
                        {filteredMovementData.totalSameWithEvents}
                    </span>
                </div>
                <div className="px-4 py-3 rounded-xl flex flex-col border bg-card border-border shadow-sm">
                    <span className="text-muted-foreground text-[10px] font-bold flex items-center gap-1 tracking-tight">
                        <Minus className="w-3 h-3" /> No Change
                    </span>
                    <span className="text-2xl font-bold font-mono mt-1 text-foreground">
                        {filteredMovementData.totalNoChange}
                    </span>
                </div>
            </div>


            {/* Person / Squad Cards */}
            {/* Person / Squad Cards */}
            {viewMode === 'recap' ? (
                filteredMovementData.personMovements.length === 0 ? (
                    <div className="text-center py-16 bg-muted/20 rounded-2xl border border-dashed border-border">
                        <Calendar className="w-12 h-12 mx-auto mb-4 opacity-10" />
                        <p className="text-lg font-bold text-foreground/50">No task data found</p>
                        <p className="text-sm text-muted-foreground mt-1 font-medium">Try selecting a different date or different squad members</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-8">
                        {/* Optional Shared Squad Progress */}
                        {filteredMovementData.sharedSquadData && (
                            <div className="w-full">
                                <h2 className="text-[11px] font-bold text-[#1D3557] dark:text-indigo-400 mb-4 tracking-tight flex items-center gap-2">
                                    <Users className="w-4 h-4" />
                                    Shared Effort ({filteredMovementData.sharedSquadData.totalTasks} Tasks)
                                </h2>
                                <PersonCard
                                    personData={filteredMovementData.sharedSquadData}
                                    onTaskClick={onTaskClick}
                                    defaultExpanded={true}
                                />
                            </div>
                        )}

                        <div className="w-full">
                            {filteredMovementData.sharedSquadData && (
                                <h2 className="text-[11px] font-bold text-muted-foreground/80 mb-4 tracking-tight flex items-center gap-2">
                                    <User className="w-4 h-4" />
                                    Individual Contributions
                                </h2>
                            )}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {filteredMovementData.personMovements.map((personData: PersonDailyMovement, idx: number) => (
                                    <PersonCard
                                        key={personData.person}
                                        personData={personData}
                                        onTaskClick={onTaskClick}
                                        defaultExpanded={idx < 3 && !filteredMovementData.sharedSquadData}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                )
            ) : (
                <div className="flex flex-col gap-6">
                    {(() => {
                        const dateStr = format(selectedDate, 'yyyy-MM-dd');
                        const squadPersons = filteredMovementData.personMovements;

                        const todoTaskMap = new Map<string, Set<string>>();
                        squadPersons.forEach(personData => {
                            const todos = getTodosForPersonDate(personData.person, dateStr);
                            todos.forEach(item => {
                                if (!todoTaskMap.has(item.taskId)) {
                                    todoTaskMap.set(item.taskId, new Set());
                                }
                                todoTaskMap.get(item.taskId)!.add(personData.person);
                            });
                        });

                        const sharedTodoTaskIds = Array.from(todoTaskMap.entries())
                            .filter(([_, persons]) => persons.size >= selectedPersonsFilter.size)
                            .map(([taskId]) => taskId);

                        if (sharedTodoTaskIds.length === 0) {
                            return (
                                <div className="text-center py-20 bg-muted/20 rounded-2xl border border-dashed border-border">
                                    <Users className="w-12 h-12 mx-auto mb-4 opacity-10" />
                                    <p className="text-lg font-bold text-foreground/50">
                                        No shared items today
                                    </p>
                                    <p className="text-sm mt-1 text-muted-foreground font-medium max-w-md mx-auto">
                                        Pick at least two people above. We&apos;ll list tasks that appear on all of their to-do lists for {getDateLabel()}.
                                    </p>
                                </div>
                            );
                        }

                        const movementByTaskId = new Map<string, TaskMovement>();
                        movementData.personMovements.forEach(personData => {
                            const all = [
                                ...personData.movedForward,
                                ...personData.movedBackward,
                                ...personData.sameWithEvents,
                                ...personData.noChange,
                            ];
                            all.forEach(tm => {
                                if (!movementByTaskId.has(tm.taskId)) {
                                    movementByTaskId.set(tm.taskId, tm);
                                }
                            });
                        });

                        const buildFallbackMovement = (taskId: string): TaskMovement => {
                            const taskLogs = rawLogs
                                .filter(l => l.taskId === taskId)
                                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                            const latest = taskLogs[0];
                            return {
                                taskId,
                                taskName: latest?.taskName ?? taskId,
                                person: 'Squad',
                                module: latest?.module ?? '',
                                screen: latest?.screen ?? '',
                                sprintGoal: latest?.sprintGoal ?? '',
                                recordLink: latest?.recordLink ?? '',
                                startStatus: null,
                                endStatus: latest?.status ?? 'Not Started',
                                movementType: 'no-change',
                                eventCount: 0,
                                lastEventTime: null,
                                eventsOnDay: [],
                                statusChain: [],
                                isNewTask: false,
                            };
                        };

                        const rows = sharedTodoTaskIds.map(taskId => {
                            const movement = movementByTaskId.get(taskId) ?? buildFallbackMovement(taskId);
                            const people: string[] = Array.from(todoTaskMap.get(taskId) ?? new Set<string>());
                            return { movement, people };
                        });

                        return (
                            <SquadSharedTasksTable
                                rows={rows}
                                onTaskClick={onTaskClick}
                            />
                        );
                    })()}
                </div>
            )}

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-6 text-[10px] text-muted-foreground/60 px-4 py-6 border-t border-border/50">
                <span className="font-bold text-foreground text-sm tracking-tight">Legend</span>
                <div className="flex items-center gap-2">
                    <TrendingUp className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    <span className="font-medium">Moved Forward</span>
                </div>
                <div className="flex items-center gap-2">
                    <TrendingDown className="w-3 h-3 text-red-600 dark:text-red-400" />
                    <span className="font-medium">Regressed</span>
                </div>
                <div className="flex items-center gap-2">
                    <Activity className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                    <span className="font-medium">Activity, Same Status</span>
                </div>
                <div className="flex items-center gap-2">
                    <Minus className="w-3 h-3 text-muted-foreground" />
                    <span className="font-medium">No Change</span>
                </div>
            </div>

        </div>
    );
}
