'use client';

import React, { useMemo, useState, useCallback, DragEvent } from 'react';
import { TaskAnalysis, MeetingNote, RawLogEvent } from '@/lib/types';
import { getStatusSeverity, isBottleneckStatus } from '@/lib/workflow-engine';
import { hasMetSprintGoal } from '@/lib/utils';
import { useDailyTodos, DailyTodoItem } from '@/lib/hooks/useDailyTodos';
import { useRoles, ROLE_ORDER, ValidRole } from '@/lib/hooks/useRoles';
import { Badge } from '../ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { format, subDays, isToday, isYesterday } from 'date-fns';
import {
    AlertTriangle,
    ArrowRight,
    ArrowRightLeft,
    Calendar,
    Check,
    CheckCircle2,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Circle,
    Clock,
    Copy,
    GitCompare,
    GripVertical,
    Hand,
    History,
    Layers,
    Lightbulb,
    Loader2,
    PlayCircle,
    Plus,
    RefreshCw,
    Repeat,
    Send,
    Sparkles,
    Target,
    TrendingUp,
    Trash2,
    User,
    UserX,
    Users,
    Zap,
    Settings,
    Shield,
} from 'lucide-react';
import { WebhookSettingsModal } from './WebhookSettingsModal';

interface DailyMeetingViewProps {
    analyses: Record<string, TaskAnalysis>;
    meetingNotes: Record<string, MeetingNote[]>;
    rawLogs: RawLogEvent[];
    sprintStartSnapshot: Record<string, string>;
    highRiskIds: Set<string>;
    activeSprint: string;
    onTaskClick: (taskId: string) => void;
}

import { TaskCategory, CategoryFilterKey, DEFAULT_CATEGORY_FILTER, PersonMeetingData } from './daily-meeting/types';
import { computePersonMeetingData, getVisibleTaskCount, priorityDotColor, statusBadge, formatCorporateName, ACTIVE_STATUSES, formatTodoListForDM, formatTodoListForWebhook, sendTodoListToWebhook, getLatestMeetingNote } from './daily-meeting/utils';
import { PersonSingleView } from './daily-meeting/PersonSingleView';
import { HistoricalView } from './daily-meeting/HistoricalView';
import { CompareView } from './daily-meeting/CompareView';
import { DraggableTaskCard } from './daily-meeting/DraggableTaskCard';

interface AllPersonsViewProps {
    personData: PersonMeetingData[];
    categoryFilter: Record<CategoryFilterKey, boolean>;
    highRiskIds: Set<string>;
    onTaskClick: (taskId: string) => void;
    meetingNotes: Record<string, MeetingNote[]>;
}

function AllPersonsView({ personData, categoryFilter, highRiskIds, onTaskClick, meetingNotes }: AllPersonsViewProps) {
    const renderTaskButton = (task: TaskAnalysis, colorScheme: 'doing' | 'blocking' | 'blocked' | 'notStarted') => {
        const isHighRisk = highRiskIds.has(task.taskId);
        const colorClasses = {
            doing: 'bg-zinc-900/50 border-zinc-800/30 hover:bg-zinc-800/50 hover:border-zinc-700/50 text-zinc-300',
            blocking: 'bg-amber-950/20 border-amber-800/30 hover:bg-amber-900/30 hover:border-amber-700/50 text-amber-200',
            blocked: 'bg-red-950/20 border-red-800/30 hover:bg-red-900/30 hover:border-red-700/50 text-red-200',
            notStarted: 'bg-zinc-900/50 border-zinc-800/30 hover:bg-zinc-800/50 hover:border-zinc-700/50 text-zinc-300',
        };

        return (
            <button
                key={task.taskId}
                onClick={() => onTaskClick(task.taskId)}
                className={`w-full text-left px-2 py-1.5 rounded border transition-colors group ${colorClasses[colorScheme]}`}
            >
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${priorityDotColor(task.currentStatus)}`} />
                    {isHighRisk && (
                        <span className="text-red-500 text-[10px] font-bold flex-shrink-0">📌</span>
                    )}
                    <span className="text-[10px] font-mono text-zinc-500">{task.taskId}</span>
                    <span className="text-xs truncate flex-1">{task.taskName}</span>
                    <ChevronRight className="w-3 h-3 text-zinc-600 group-hover:text-zinc-400 transition-colors flex-shrink-0" />
                </div>
            </button>
        );
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {personData.map((data) => {
                const hasBlocking = data.categories.blockingOthers.length > 0;
                const hasBlocked = data.categories.blockedByOthers.length > 0;
                const hasDoing = data.categories.doing.length > 0;

                return (
                    <div
                        key={data.person}
                        className={`rounded-xl border p-4 transition-all ${
                            hasBlocking
                                ? 'border-amber-700/60 bg-amber-950/10'
                                : hasBlocked
                                    ? 'border-red-700/40 bg-red-950/10'
                                    : hasDoing
                                        ? 'border-blue-700/40 bg-blue-950/10'
                                        : 'border-zinc-800 bg-zinc-950/50'
                        }`}
                    >
                        <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-800/50">
                            <div className="flex items-center gap-2">
                                <div className={`w-3 h-3 rounded-full ${
                                    hasBlocking ? 'bg-amber-500 animate-pulse' :
                                    hasBlocked ? 'bg-red-500 animate-pulse' :
                                    hasDoing ? 'bg-blue-500' : 'bg-zinc-500'
                                }`} />
                                <h3 className="font-semibold text-zinc-100">{data.person}</h3>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] font-mono flex-wrap">
                                {categoryFilter.doing && data.categories.doing.length > 0 && (
                                    <Badge className="bg-blue-950/50 text-blue-300 border-blue-800/50">
                                        {data.categories.doing.length} doing
                                    </Badge>
                                )}
                                {categoryFilter.blockingOthers && data.categories.blockingOthers.length > 0 && (
                                    <Badge className="bg-amber-950/50 text-amber-300 border-amber-800/50">
                                        {data.categories.blockingOthers.length} blocking
                                    </Badge>
                                )}
                                {categoryFilter.blockedByOthers && data.categories.blockedByOthers.length > 0 && (
                                    <Badge className="bg-red-950/50 text-red-300 border-red-800/50">
                                        {data.categories.blockedByOthers.length} blocked
                                    </Badge>
                                )}
                                {categoryFilter.notStarted && data.categories.notStartedInSprint.length > 0 && (
                                    <Badge className="bg-orange-950/50 text-orange-300 border-orange-800/50">
                                        {data.categories.notStartedInSprint.length} no activity
                                    </Badge>
                                )}
                                {categoryFilter.other && data.categories.other.length > 0 && (
                                    <Badge className="bg-zinc-800/50 text-zinc-400 border-zinc-700/50">
                                        {data.categories.other.length} pending
                                    </Badge>
                                )}
                            </div>
                        </div>

                        <div className="space-y-3">
                            {categoryFilter.doing && data.categories.doing.length > 0 && (
                                <div>
                                    <div className="flex items-center gap-2 mb-2 text-blue-400">
                                        <PlayCircle className="w-3 h-3" />
                                        <span className="text-[10px] font-semibold uppercase">Doing</span>
                                    </div>
                                    <div className="space-y-1">
                                        {data.categories.doing.map((task) => renderTaskButton(task, 'doing'))}
                                    </div>
                                </div>
                            )}

                            {categoryFilter.blockingOthers && data.categories.blockingOthers.length > 0 && (
                                <div>
                                    <div className="flex items-center gap-2 mb-2 text-amber-400">
                                        <Hand className="w-3 h-3" />
                                        <span className="text-[10px] font-semibold uppercase">Blocking others</span>
                                    </div>
                                    <div className="space-y-1">
                                        {data.categories.blockingOthers.map((task) => renderTaskButton(task, 'blocking'))}
                                    </div>
                                </div>
                            )}

                            {categoryFilter.blockedByOthers && data.categories.blockedByOthers.length > 0 && (
                                <div>
                                    <div className="flex items-center gap-2 mb-2 text-red-400">
                                        <UserX className="w-3 h-3" />
                                        <span className="text-[10px] font-semibold uppercase">Blocked by others</span>
                                    </div>
                                    <div className="space-y-1">
                                        {data.categories.blockedByOthers.map((task) => renderTaskButton(task, 'blocked'))}
                                    </div>
                                </div>
                            )}

                            {categoryFilter.notStarted && data.categories.notStartedInSprint.length > 0 && (
                                <div>
                                    <div className="flex items-center gap-2 mb-2 text-orange-400">
                                        <AlertTriangle className="w-3 h-3" />
                                        <span className="text-[10px] font-semibold uppercase">No Activity in Sprint</span>
                                    </div>
                                    <div className="space-y-1">
                                        {data.categories.notStartedInSprint.map((task) => renderTaskButton(task, 'notStarted'))}
                                    </div>
                                </div>
                            )}

                            {categoryFilter.other && data.categories.other.length > 0 && (
                                <div>
                                    <div className="flex items-center gap-2 mb-2 text-zinc-400">
                                        <Clock className="w-3 h-3" />
                                        <span className="text-[10px] font-semibold uppercase">Pending</span>
                                    </div>
                                    <div className="space-y-1">
                                        {data.categories.other.map((task) => renderTaskButton(task, 'notStarted'))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

interface SquadsViewProps {
    analyses: Record<string, TaskAnalysis>;
    categoryFilter: Record<CategoryFilterKey, boolean>;
    highRiskIds: Set<string>;
    onTaskClick: (taskId: string) => void;
    meetingNotes: Record<string, MeetingNote[]>;
    dailyTodos: ReturnType<typeof useDailyTodos>;
    selectedDate: Date;
    allPersonData: PersonMeetingData[];
    roles: Record<string, string>;
    activeSprint: string;
}

function SquadsView({
    analyses,
    categoryFilter,
    highRiskIds,
    onTaskClick,
    meetingNotes,
    dailyTodos,
    selectedDate,
    allPersonData,
    roles,
    activeSprint,
}: SquadsViewProps) {
    const [selectedPersonsFilter, setSelectedPersonsFilter] = useState<Set<string>>(new Set());
    const [dragOverTodo, setDragOverTodo] = useState(false);
    const [copied, setCopied] = useState(false);
    const [sending, setSending] = useState(false);
    const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);
    const dateStr = format(selectedDate, 'yyyy-MM-dd');

    const squadMembers = Array.from(selectedPersonsFilter).sort((a, b) => {
        const roleA = roles[a] || 'Other';
        const roleB = roles[b] || 'Other';
        const indexA = ROLE_ORDER.indexOf(roleA as ValidRole);
        const indexB = ROLE_ORDER.indexOf(roleB as ValidRole);
        const posA = indexA === -1 ? 99 : indexA;
        const posB = indexB === -1 ? 99 : indexB;
        if (posA !== posB) return posA - posB;
        return a.localeCompare(b);
    });

    const sortedAllPersonData = useMemo(() => {
        return [...allPersonData].sort((a, b) => {
            const roleA = roles[a.person] || 'Other';
            const roleB = roles[b.person] || 'Other';
            const indexA = ROLE_ORDER.indexOf(roleA as ValidRole);
            const indexB = ROLE_ORDER.indexOf(roleB as ValidRole);
            const posA = indexA === -1 ? 99 : indexA;
            const posB = indexB === -1 ? 99 : indexB;
            if (posA !== posB) return posA - posB;
            return a.person.localeCompare(b.person);
        });
    }, [allPersonData, roles]);

    const handleCopyForDM = useCallback(() => {
        const texts = squadMembers.map(member => {
            const todosForDate = dailyTodos.getTodosForPersonDate(member, dateStr);
            if (todosForDate.length === 0) return null;
            return formatTodoListForDM(member, todosForDate, analyses, meetingNotes, allPersonData);
        }).filter(Boolean);
        
        if (texts.length === 0) return;
        
        navigator.clipboard.writeText(texts.join('\n\n---\n\n')).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    }, [squadMembers, dateStr, dailyTodos, analyses, meetingNotes, allPersonData]);

    const handleSendToWebhook = useCallback(async () => {
        if (sending) return;

        setSending(true);
        setSendResult(null);
        
        let allSuccess = true;
        let errorMessage = '';
        let sentCount = 0;

        for (const member of squadMembers) {
            const todosForDate = dailyTodos.getTodosForPersonDate(member, dateStr);
            if (todosForDate.length === 0) continue;

            const payload = formatTodoListForWebhook(
                member,
                dateStr,
                todosForDate,
                analyses,
                meetingNotes,
                allPersonData
            );
            
            const result = await sendTodoListToWebhook(payload);
            if (!result.success) {
                allSuccess = false;
                errorMessage = result.error || 'Failed to send';
                break;
            }
            sentCount++;
        }
        
        setSending(false);
        if (sentCount === 0) {
            setSendResult({ success: false, message: 'No tasks to send' });
        } else {
            setSendResult({
                success: allSuccess,
                message: allSuccess ? 'Sent for all!' : errorMessage,
            });
        }
        
        setTimeout(() => setSendResult(null), 3000);
    }, [sending, squadMembers, dateStr, dailyTodos, analyses, meetingNotes, allPersonData]);

    // Compute derived tasks for Backlog (aligned with NextSprintPlanningView approach)
    const { combinationBacklogs, individualBacklog } = useMemo(() => {
        if (squadMembers.length === 0) return { combinationBacklogs: [], individualBacklog: {} as Record<string, TaskAnalysis[]> };

        const combinations = new Map<string, TaskAnalysis[]>();
        const individual: Record<string, TaskAnalysis[]> = {};
        squadMembers.forEach(sm => individual[sm] = []);

        // Use all uncompleted, sprint-filtered tasks — same approach as NextSprintPlanningView
        const uncompletedTasks: TaskAnalysis[] = [];
        Object.values(analyses).forEach(task => {
            if (task.currentStatus === 'Completed') return;
            if (activeSprint && String(task.sprint) !== String(activeSprint)) return;
            uncompletedTasks.push(task);
        });

        uncompletedTasks.forEach(task => {
            // Use currentPerson directly (same as NextSprintPlanningView)
            const assignees = task.currentPerson ? task.currentPerson.split(',').map(p => p.trim()).filter(Boolean) : [];
            const involved = squadMembers.filter(sm => assignees.includes(sm));

            if (involved.length === 0) return; // Task not assigned to any squad member

            // Check if fully planned by all involved squad members
            const isFullyPlanned = involved.every(sm => {
                const todos = dailyTodos.getTodosForPersonDate(sm, dateStr);
                return todos.some(todo => todo.taskId === task.taskId);
            });

            if (isFullyPlanned) return; // Skip if fully planned

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
            tasks.sort((a, b) => b.staleDurationMs - a.staleDurationMs);
            return {
                involvedList: key.split('|'),
                tasks
            };
        });

        // Sort combinations: largest groups first, then alphabetically
        combinationArray.sort((a, b) => {
            if (a.involvedList.length !== b.involvedList.length) {
                return b.involvedList.length - a.involvedList.length;
            }
            return a.involvedList.join(',').localeCompare(b.involvedList.join(','));
        });

        Object.keys(individual).forEach(key => {
            individual[key].sort((a, b) => b.staleDurationMs - a.staleDurationMs);
        });

        return { combinationBacklogs: combinationArray, individualBacklog: individual };
    }, [analyses, squadMembers, activeSprint, dailyTodos, dateStr]);

    // Compute derived tasks for Squad Plan
    const { combinationPlans, individualPlans } = useMemo(() => {
        const combinations = new Map<string, { task: TaskAnalysis, plannedBy: Set<string>, involved: string[] }>();
        const individual: Record<string, { task: TaskAnalysis, completedAt?: string }[]> = {};
        squadMembers.forEach(sm => individual[sm] = []);

        squadMembers.forEach(sm => {
            const todos = dailyTodos.getTodosForPersonDate(sm, dateStr);
            todos.forEach(todo => {
                const task = analyses[todo.taskId];
                if (!task || (activeSprint && String(task.sprint) !== String(activeSprint))) return;

                // Robustly check who in the squad has this planned
                const involved = squadMembers.filter(m => {
                    const personTodos = dailyTodos.getTodosForPersonDate(m, dateStr);
                    return personTodos.some(t => t.taskId === task.taskId);
                });

                if (involved.length > 1) {
                    involved.sort((a, b) => a.localeCompare(b));
                    const key = involved.join('|');
                    const compKey = `${key}-${task.taskId}`;
                    if (!combinations.has(compKey)) {
                        combinations.set(compKey, { task, plannedBy: new Set([sm]), involved });
                    } else {
                        combinations.get(compKey)!.plannedBy.add(sm);
                    }
                } else if (involved.length === 1) {
                    if (!individual[sm].some(t => t.task.taskId === task.taskId)) {
                        individual[sm].push({ task, completedAt: todo.completedAt });
                    }
                }
            });
        });

        // Group combinations together by involved members
        const groupedMap = new Map<string, { task: TaskAnalysis, plannedBy: Set<string>, involved: string[] }[]>();
        
        combinations.forEach((data) => {
            const key = data.involved.join('|');
            if (!groupedMap.has(key)) groupedMap.set(key, []);
            groupedMap.get(key)!.push(data);
        });

        const combinationArray = Array.from(groupedMap.entries()).map(([key, items]) => {
            return {
                involvedList: key.split('|'),
                items
            };
        });

        combinationArray.sort((a, b) => {
            if (a.involvedList.length !== b.involvedList.length) {
                return b.involvedList.length - a.involvedList.length;
            }
            return a.involvedList.join(',').localeCompare(b.involvedList.join(','));
        });

        return { combinationPlans: combinationArray, individualPlans: individual };
    }, [squadMembers, dailyTodos, dateStr, analyses]);

    const handleDragStart = (e: DragEvent, taskId: string) => {
        e.dataTransfer.setData('text/plain', taskId);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverTodo(true);
    };

    const handleDragLeave = () => {
        setDragOverTodo(false);
    };

    const handleDrop = (e: DragEvent) => {
        e.preventDefault();
        setDragOverTodo(false);
        const taskId = e.dataTransfer.getData('text/plain');
        if (taskId) {
            const task = analyses[taskId];
            if (!task) return;
            const assignees = task.currentPerson ? task.currentPerson.split(',').map(p => p.trim()) : [];
            const involved = squadMembers.filter(m => assignees.includes(m));
            
            if (involved.length > 0) {
                involved.forEach(sm => {
                    const todos = dailyTodos.getTodosForPersonDate(sm, dateStr);
                    if (!todos.some(t => t.taskId === taskId)) {
                        dailyTodos.addTodo(sm, dateStr, taskId);
                    }
                });
            } else if (squadMembers.length === 1) {
                 const todos = dailyTodos.getTodosForPersonDate(squadMembers[0], dateStr);
                 if (!todos.some(t => t.taskId === taskId)) {
                     dailyTodos.addTodo(squadMembers[0], dateStr, taskId);
                 }
            }
        }
    };

    const renderCard = (task: TaskAnalysis, context: 'backlog' | 'plan', member?: string, completed?: boolean, isSharedPlan?: boolean, sharedPlanData?: { plannedBy: Set<string>, involved: string[] }) => {
        const notes = meetingNotes[task.taskId] || [];
        const latestNote = getLatestMeetingNote(notes);
        const isBlockedByOthers = latestNote?.isStall && latestNote.blockedBy;
        const blockedByLabel = isBlockedByOthers ? latestNote.blockedBy : task.blockedBy;

        const getCategoryLabel = () => {
            if (task.currentStatus === 'Reprocess' || task.currentStatus === 'Reviewing' || task.currentStatus === 'Waiting to Integrate') {
                return { text: 'In bottleneck', color: 'bg-amber-950/50 text-amber-300', icon: <AlertTriangle className="w-2.5 h-2.5" /> };
            }
            if (ACTIVE_STATUSES.has(task.currentStatus)) {
                return { text: 'Active', color: 'bg-blue-950/50 text-blue-300', icon: <PlayCircle className="w-2.5 h-2.5" /> };
            }
            if (task.currentStatus === 'Not Started') {
                return { text: 'Not started', color: 'bg-zinc-800/50 text-zinc-400', icon: <Circle className="w-2.5 h-2.5" /> };
            }
            return undefined;
        };

        const onQuickAdd = () => {
            const assignees = task.currentPerson ? task.currentPerson.split(',').map(p => p.trim()) : [];
            const involved = squadMembers.filter(m => assignees.includes(m));
            if (involved.length > 0) {
                involved.forEach(sm => dailyTodos.addTodo(sm, dateStr, task.taskId));
            } else if (squadMembers.length === 1) {
                dailyTodos.addTodo(squadMembers[0], dateStr, task.taskId);
            }
        };

        const onRemove = () => {
            if (isSharedPlan && sharedPlanData) {
                sharedPlanData.plannedBy.forEach(sm => dailyTodos.removeTodo(sm, dateStr, task.taskId));
            } else if (member) {
                dailyTodos.removeTodo(member, dateStr, task.taskId);
            }
        };

        const onToggle = () => {
            if (isSharedPlan && sharedPlanData) {
                sharedPlanData.plannedBy.forEach(sm => dailyTodos.toggleTodoComplete(sm, dateStr, task.taskId));
            } else if (member) {
                dailyTodos.toggleTodoComplete(member, dateStr, task.taskId);
            }
        };

        return (
            <div key={task.taskId} className="relative group/card">
                <DraggableTaskCard
                    task={task}
                    isHighRisk={highRiskIds.has(task.taskId)}
                    onTaskClick={onTaskClick}
                    isDraggable={context === 'backlog'}
                    onDragStart={handleDragStart}
                    isInTodoList={context === 'plan'}
                    todoCompleted={completed}
                    showSprintGoal={context === 'plan'}
                    showQuickAdd={context === 'backlog'}
                    onQuickAdd={onQuickAdd}
                    onRemoveFromTodo={onRemove}
                    onToggleComplete={onToggle}
                    categoryLabel={getCategoryLabel()}
                    blockedByLabel={blockedByLabel}
                    renderActions={
                        isSharedPlan && sharedPlanData && !completed ? (
                            <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-700 rounded p-0.5" onClick={(e) => e.stopPropagation()}>
                                {sharedPlanData.involved.map(inv => {
                                    const isPlanning = sharedPlanData.plannedBy.has(inv);
                                    return (
                                        <button
                                            key={inv}
                                            onClick={() => {
                                                if (isPlanning) dailyTodos.removeTodo(inv, dateStr, task.taskId);
                                                else dailyTodos.addTodo(inv, dateStr, task.taskId);
                                            }}
                                            className={`px-1.5 h-5 min-w-[20px] flex items-center justify-center rounded text-[10px] font-bold transition-colors ${
                                                isPlanning 
                                                    ? 'bg-indigo-600 text-white' 
                                                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
                                            }`}
                                            title={isPlanning ? `${inv} planned this` : `Add to ${inv}'s plan`}
                                        >
                                            {formatCorporateName(inv)}
                                        </button>
                                    );
                                })}
                            </div>
                        ) : null
                    }
                />
            </div>
        );
    };

    return (
        <div className="space-y-4 flex flex-col min-h-[500px]">
            {/* Personnel Selector Row */}
            <div className="bg-zinc-950/50 p-3 rounded-xl border border-zinc-800 flex flex-col gap-2 flex-shrink-0">
                <div className="flex items-center gap-2 mb-1">
                    <Users className="w-4 h-4 text-indigo-400" />
                    <span className="font-semibold text-zinc-200 text-sm">Gradually form your squad</span>
                </div>
                <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
                    {sortedAllPersonData.map(p => {
                        const isSelected = selectedPersonsFilter.has(p.person);
                        return (
                            <button
                                key={p.person}
                                onClick={() => {
                                    const next = new Set(selectedPersonsFilter);
                                    if (isSelected) next.delete(p.person);
                                    else next.add(p.person);
                                    setSelectedPersonsFilter(next);
                                }}
                                className={`flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${
                                    isSelected 
                                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-[0_0_10px_rgba(79,70,229,0.3)]'
                                        : 'bg-zinc-900/80 border-zinc-700/80 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                                }`}
                            >
                                <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white/80' : 'bg-zinc-600'}`} />
                                <span className="text-sm font-medium">{p.person}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {selectedPersonsFilter.size === 0 ? (
                <div className="flex-1 flex items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950/50">
                    <div className="text-center py-12 px-4 max-w-md">
                        <Users className="w-12 h-12 mx-auto mb-4 text-indigo-500/30" />
                        <h3 className="text-zinc-200 font-semibold mb-2">No Personnel Selected</h3>
                        <p className="text-sm text-zinc-400">
                            Select one or more team members above to start forming a squad. The views below will dynamically update to show shared tasks, individual tasks, and blockers for the selected team members.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0">
                    {/* Left Column: Squad Backlog */}
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 flex flex-col min-h-0 overflow-hidden" style={{ maxHeight: '70vh' }}>
                        <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-800/50 flex-shrink-0">
                            <div className="flex items-center gap-2">
                                <Layers className="w-4 h-4 text-indigo-400" />
                                <h3 className="font-semibold text-zinc-100">Squad Backlog</h3>
                            </div>
                            <Badge variant="outline" className="text-[10px] border-indigo-800/50 text-indigo-300 bg-indigo-950/20">
                                {combinationBacklogs.reduce((sum, g) => sum + g.tasks.length, 0) + squadMembers.reduce((sum, m) => sum + individualBacklog[m].length, 0)} tasks
                            </Badge>
                        </div>

                        <div className="text-[10px] text-zinc-500 mb-3 flex items-center gap-1 flex-shrink-0">
                            <GripVertical className="w-3 h-3" />
                            Drag tasks to the Squad Plan to plan them
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-6 pb-8">
                            {/* Combination Backlog Sections */}
                            {combinationBacklogs.map(group => (
                                <div key={group.involvedList.join('|')} className="space-y-2">
                                    <div className="flex items-center gap-2 text-indigo-400 border-b border-indigo-900/30 pb-1">
                                        <Users className="w-3.5 h-3.5" />
                                        <h4 className="text-xs font-semibold uppercase tracking-wider">
                                            {group.involvedList.length === squadMembers.length 
                                                ? `Shared by Squad (${group.tasks.length})`
                                                : `Shared: ${group.involvedList.join(', ')} (${group.tasks.length})`}
                                        </h4>
                                    </div>
                                    <div className="space-y-1.5 pl-2 border-l border-indigo-900/30">
                                        {group.tasks.map(task => renderCard(task, 'backlog'))}
                                    </div>
                                </div>
                            ))}

                            {/* Individual Backlog Sections */}
                            {squadMembers.map(member => {
                                const tasks = individualBacklog[member] || [];
                                if (tasks.length === 0) return null;
                                return (
                                    <div key={member} className="space-y-2">
                                        <div className="flex items-center gap-2 text-zinc-400 border-b border-zinc-800/50 pb-1">
                                            <User className="w-3.5 h-3.5" />
                                            <h4 className="text-xs font-semibold uppercase tracking-wider">{member}'s Tasks ({tasks.length})</h4>
                                        </div>
                                        <div className="space-y-1.5 pl-2 border-l border-zinc-800/50">
                                            {tasks.map(task => renderCard(task, 'backlog', member))}
                                        </div>
                                    </div>
                                );
                            })}

                            {combinationBacklogs.length === 0 && squadMembers.every(m => individualBacklog[m].length === 0) && (
                                <div className="text-center py-8 text-zinc-500 text-sm border-t border-zinc-800/30 mt-4">
                                    No tasks in backlog for the selected personnel.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Squad Plan */}
                    <div 
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`rounded-xl border p-4 flex flex-col min-h-0 overflow-hidden transition-colors ${
                            dragOverTodo
                                ? 'border-indigo-500 bg-indigo-950/20 border-dashed'
                                : 'border-zinc-800 bg-zinc-950/50'
                        }`}
                        style={{ maxHeight: '70vh' }}
                    >
                        <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-800/50 flex-shrink-0">
                            <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-emerald-400" />
                                <h3 className="font-semibold text-zinc-100">Squad Plan for {isToday(selectedDate) ? "Today" : format(selectedDate, 'MMM d')}</h3>
                                {squadMembers.some(sm => dailyTodos.getTodosForPersonDate(sm, dateStr).length > 0) && (
                                    <div className="flex items-center gap-1 ml-2">
                                        <button
                                            type="button"
                                            onClick={handleCopyForDM}
                                            className="p-1.5 rounded-md hover:bg-zinc-700/80 text-zinc-400 hover:text-zinc-200 transition-colors flex items-center gap-1"
                                            title="Copy all squad plans for DM"
                                        >
                                            {copied ? (
                                                <span className="text-[10px] text-emerald-400 font-medium px-1">Copied!</span>
                                            ) : (
                                                <Copy className="w-3.5 h-3.5" />
                                            )}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleSendToWebhook}
                                            disabled={sending}
                                            className={`p-1.5 rounded-md transition-colors flex items-center gap-1 ${
                                                sending
                                                    ? 'bg-indigo-900/50 text-indigo-300 cursor-not-allowed'
                                                    : sendResult
                                                        ? sendResult.success
                                                            ? 'bg-emerald-900/50 text-emerald-300'
                                                            : 'bg-red-900/50 text-red-300'
                                                        : 'hover:bg-indigo-700/80 text-indigo-400 hover:text-indigo-200'
                                            }`}
                                            title="Send all squad plans to Lark"
                                        >
                                            {sending ? (
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            ) : sendResult ? (
                                                <span className={`text-[10px] font-medium px-1 ${sendResult.success ? 'text-emerald-400' : 'text-red-400'}`}>
                                                    {sendResult.message}
                                                </span>
                                            ) : (
                                                <Send className="w-3.5 h-3.5" />
                                            )}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {dragOverTodo && (
                            <div className="flex items-center justify-center py-4 mb-3 rounded-lg border-2 border-dashed border-indigo-500/50 bg-indigo-950/30 flex-shrink-0">
                                <Plus className="w-4 h-4 text-indigo-400 mr-2" />
                                <span className="text-indigo-300 text-sm">Drop to plan for squad</span>
                            </div>
                        )}

                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-6 pb-8">
                            {/* Combination Plans Sections */}
                             {combinationPlans.map(group => (
                                <div key={group.involvedList.join('|')} className="space-y-2">
                                    <div className="flex items-center gap-2 text-indigo-400 border-b border-indigo-900/30 pb-1">
                                        <Users className="w-3.5 h-3.5" />
                                        <h4 className="text-xs font-semibold uppercase tracking-wider">
                                            {group.involvedList.length === squadMembers.length 
                                                ? `Squad Deliverables`
                                                : `Shared: ${group.involvedList.join(', ')}`}
                                        </h4>
                                    </div>
                                    <div className="space-y-1.5 pl-2 border-l border-indigo-900/30">
                                        {group.items.map(planData => {
                                            const isCompleted = Array.from(planData.plannedBy).some(sm => {
                                                const t = dailyTodos.getTodosForPersonDate(sm, dateStr).find(tt => tt.taskId === planData.task.taskId);
                                                return t?.completedAt;
                                            });
                                            return renderCard(planData.task, 'plan', undefined, isCompleted, true, planData);
                                        })}
                                    </div>
                                </div>
                            ))}

                            {/* Individual Plans Sections */}
                            {squadMembers.map(member => {
                                const plans = individualPlans[member] || [];
                                if (plans.length === 0) return null;
                                return (
                                    <div key={member} className="space-y-2">
                                        <div className="flex items-center gap-2 text-emerald-400 border-b border-emerald-900/30 pb-1">
                                            <User className="w-3.5 h-3.5" />
                                            <h4 className="text-xs font-semibold uppercase tracking-wider">{member}'s Plan</h4>
                                        </div>
                                        <div className="space-y-1.5 pl-2 border-l border-emerald-900/30">
                                            {plans.map(p => renderCard(p.task, 'plan', member, !!p.completedAt, false))}
                                        </div>
                                    </div>
                                );
                            })}
                            
                            {combinationPlans.length === 0 && squadMembers.every(m => individualPlans[m].length === 0) && !dragOverTodo && (
                                <div className="text-center py-12 text-zinc-500 border-t border-zinc-800/30 mt-4">
                                    <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30 text-emerald-500" />
                                    <p className="text-sm">No tasks planned for the squad</p>
                                    <p className="text-xs mt-1">Drag tasks from the backlog to plan</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export function DailyMeetingView({
    analyses,
    meetingNotes,
    rawLogs,
    sprintStartSnapshot,
    highRiskIds,
    activeSprint,
    onTaskClick,
}: DailyMeetingViewProps) {
    const personData = useMemo(
        () => computePersonMeetingData(analyses, meetingNotes, rawLogs, sprintStartSnapshot, activeSprint),
        [analyses, meetingNotes, rawLogs, sprintStartSnapshot, activeSprint]
    );

    const dailyTodos = useDailyTodos();
    const { roles, updateRole } = useRoles();

    const [viewMode, setViewMode] = useState<'single' | 'all' | 'squads'>('single');
    const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [showHistory, setShowHistory] = useState(false);
    const [showCompare, setShowCompare] = useState(false);
    const [personDropdownOpen, setPersonDropdownOpen] = useState(false);
    const [rolesModalOpen, setRolesModalOpen] = useState(false);
    const [webhooksModalOpen, setWebhooksModalOpen] = useState(false);
    const [categoryFilter, setCategoryFilter] = useState<Record<CategoryFilterKey, boolean>>(() => ({ ...DEFAULT_CATEGORY_FILTER }));

    const filteredPersonData = useMemo(() => {
        return personData.filter((p) => getVisibleTaskCount(p, categoryFilter) > 0);
    }, [personData, categoryFilter]);

    const currentPersonData = useMemo(() => {
        if (!selectedPerson && filteredPersonData.length > 0) {
            return filteredPersonData[0];
        }
        return filteredPersonData.find((p) => p.person === selectedPerson) || filteredPersonData[0];
    }, [selectedPerson, filteredPersonData]);

    const stats = useMemo(() => {
        let totalDoing = 0;
        let totalBlocking = 0;
        let totalBlocked = 0;
        let totalNotStarted = 0;
        let totalOther = 0;

        filteredPersonData.forEach((p) => {
            if (categoryFilter.doing) totalDoing += p.categories.doing.length;
            if (categoryFilter.blockingOthers) totalBlocking += p.categories.blockingOthers.length;
            if (categoryFilter.blockedByOthers) totalBlocked += p.categories.blockedByOthers.length;
            if (categoryFilter.notStarted) totalNotStarted += p.categories.notStartedInSprint.length;
            if (categoryFilter.other) totalOther += p.categories.other.length;
        });

        return { totalDoing, totalBlocking, totalBlocked, totalNotStarted, totalOther };
    }, [filteredPersonData, categoryFilter]);

    const navigateDate = useCallback((direction: 'prev' | 'next') => {
        setSelectedDate((prev) => {
            const newDate = new Date(prev);
            newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
            if (newDate > new Date()) return prev;
            return newDate;
        });
    }, []);

    return (
        <div className="space-y-4">
            {/* Control Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-zinc-800/50">
                {/* View Mode Toggle */}
                <div className="flex items-center gap-2">
                    <div className="flex rounded-lg border border-zinc-800 p-0.5 bg-zinc-950">
                        <button
                            onClick={() => setViewMode('single')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                                viewMode === 'single'
                                    ? 'bg-blue-600 text-white'
                                    : 'text-zinc-400 hover:text-zinc-200'
                            }`}
                        >
                            <User className="w-3 h-3" />
                            Single Person
                        </button>
                        <button
                            onClick={() => setViewMode('all')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                                viewMode === 'all'
                                    ? 'bg-blue-600 text-white'
                                    : 'text-zinc-400 hover:text-zinc-200'
                            }`}
                        >
                            <Users className="w-3 h-3" />
                            View All
                        </button>
                        <button
                            onClick={() => setViewMode('squads')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                                viewMode === 'squads'
                                    ? 'bg-indigo-600 text-white'
                                    : 'text-zinc-400 hover:text-zinc-200'
                            }`}
                        >
                            <Users className="w-3 h-3" />
                            Squads
                        </button>
                    </div>

                    {/* Person Selector (only in single mode) */}
                    {viewMode === 'single' && currentPersonData && (
                        <div className="relative">
                            <button
                                onClick={() => setPersonDropdownOpen(!personDropdownOpen)}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 transition-colors"
                            >
                                <div className={`w-2 h-2 rounded-full ${
                                    currentPersonData.categories.blockingOthers.length > 0
                                        ? 'bg-amber-500'
                                        : currentPersonData.categories.blockedByOthers.length > 0
                                            ? 'bg-red-500'
                                            : 'bg-blue-500'
                                }`} />
                                <span className="text-sm text-zinc-200">{currentPersonData.person}</span>
                                <ChevronDown className="w-3 h-3 text-zinc-500" />
                            </button>
                            {personDropdownOpen && (
                                <>
                                    <div
                                        className="fixed inset-0 z-10"
                                        onClick={() => setPersonDropdownOpen(false)}
                                    />
                                    <div className="absolute top-full left-0 mt-1 w-64 max-h-80 overflow-y-auto custom-scrollbar rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl z-20">
                                        {filteredPersonData.map((p) => (
                                            <button
                                                key={p.person}
                                                onClick={() => {
                                                    setSelectedPerson(p.person);
                                                    setPersonDropdownOpen(false);
                                                }}
                                                className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-zinc-800 transition-colors ${
                                                    p.person === currentPersonData.person ? 'bg-zinc-800' : ''
                                                }`}
                                            >
                                                <div className={`w-2 h-2 rounded-full ${
                                                    p.categories.blockingOthers.length > 0
                                                        ? 'bg-amber-500'
                                                        : p.categories.blockedByOthers.length > 0
                                                            ? 'bg-red-500'
                                                            : p.categories.doing.length > 0
                                                                ? 'bg-blue-500'
                                                                : 'bg-zinc-500'
                                                }`} />
                                                <span className="text-sm text-zinc-200 flex-1">{p.person}</span>
                                                <div className="flex items-center gap-1">
                                                    {p.categories.blockingOthers.length > 0 && (
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950/50 text-amber-300">
                                                            {p.categories.blockingOthers.length}
                                                        </span>
                                                    )}
                                                    <span className="text-[10px] text-zinc-500">{p.totalTasks}</span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Date Navigation & History (only in single mode) */}
                {viewMode === 'single' && (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => {
                                setShowCompare(!showCompare);
                                if (!showCompare) setShowHistory(false);
                            }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                                showCompare
                                    ? 'border-cyan-600 bg-cyan-950/30 text-cyan-300'
                                    : 'border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600'
                            }`}
                        >
                            <GitCompare className="w-3 h-3" />
                            Compare
                        </button>
                        <button
                            onClick={() => {
                                setShowHistory(!showHistory);
                                if (!showHistory) setShowCompare(false);
                            }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                                showHistory
                                    ? 'border-purple-600 bg-purple-950/30 text-purple-300'
                                    : 'border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600'
                            }`}
                        >
                            <History className="w-3 h-3" />
                            History
                        </button>

                        {!showHistory && !showCompare && (
                            <div className="flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-900 p-0.5">
                                <button
                                    onClick={() => navigateDate('prev')}
                                    className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => setSelectedDate(new Date())}
                                    className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                                        isToday(selectedDate)
                                            ? 'bg-blue-600 text-white'
                                            : 'text-zinc-300 hover:bg-zinc-800'
                                    }`}
                                >
                                    {isToday(selectedDate) ? 'Today' : format(selectedDate, 'MMM d')}
                                </button>
                                <button
                                    onClick={() => navigateDate('next')}
                                    disabled={isToday(selectedDate)}
                                    className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Category filter: Doing, Blocked by others, Blocking others, No Activity, Pending */}
                <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500 mr-1">Filter:</span>
                    {(['doing', 'blockedByOthers', 'blockingOthers', 'notStarted', 'other'] as const).map((key) => {
                        const labelMap: Record<CategoryFilterKey, string> = {
                            doing: 'Doing',
                            blockedByOthers: 'Blocked',
                            blockingOthers: 'Blocking',
                            notStarted: 'No Activity',
                            other: 'Pending',
                        };
                        const label = labelMap[key];
                        const active = categoryFilter[key];
                        return (
                            <button
                                key={key}
                                onClick={() => setCategoryFilter((prev) => ({ ...prev, [key]: !prev[key] }))}
                                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors ${
                                    active
                                        ? key === 'doing'
                                            ? 'bg-blue-600/80 text-white'
                                            : key === 'blockedByOthers'
                                                ? 'bg-red-600/80 text-white'
                                                : key === 'blockingOthers'
                                                    ? 'bg-amber-600/80 text-white'
                                                    : key === 'notStarted'
                                                        ? 'bg-orange-600/80 text-white'
                                                        : 'bg-zinc-600 text-zinc-100'
                                        : 'bg-zinc-800/80 text-zinc-500 hover:text-zinc-300'
                                }`}
                            >
                                {label}
                            </button>
                        );
                    })}
                </div>

                {/* Quick Stats */}
                <div className="flex items-center gap-3 text-[10px]">
                    {categoryFilter.doing && (
                        <div className="flex items-center gap-1 text-blue-400">
                            <PlayCircle className="w-3 h-3" />
                            <span className="font-mono">{stats.totalDoing}</span>
                        </div>
                    )}
                    {categoryFilter.blockingOthers && (
                        <div className="flex items-center gap-1 text-amber-400">
                            <Hand className="w-3 h-3" />
                            <span className="font-mono">{stats.totalBlocking}</span>
                        </div>
                    )}
                    {categoryFilter.blockedByOthers && (
                        <div className="flex items-center gap-1 text-red-400">
                            <UserX className="w-3 h-3" />
                            <span className="font-mono">{stats.totalBlocked}</span>
                        </div>
                    )}
                    {categoryFilter.notStarted && (
                        <div className="flex items-center gap-1 text-orange-400">
                            <AlertTriangle className="w-3 h-3" />
                            <span className="font-mono">{stats.totalNotStarted}</span>
                        </div>
                    )}
                    {categoryFilter.other && (
                        <div className="flex items-center gap-1 text-zinc-400">
                            <Clock className="w-3 h-3" />
                            <span className="font-mono">{stats.totalOther}</span>
                        </div>
                    )}
                    <button
                        onClick={() => setRolesModalOpen(true)}
                        className="flex items-center gap-1 px-2 py-1.5 rounded border border-zinc-700 hover:bg-zinc-800 text-zinc-300 transition-colors ml-2"
                        title="Configure Member Roles"
                    >
                        <Settings className="w-3 h-3" />
                        Roles
                    </button>
                    <button
                        onClick={() => setWebhooksModalOpen(true)}
                        className="flex items-center gap-1 px-2 py-1.5 rounded border border-zinc-700 hover:bg-zinc-800 text-zinc-300 transition-colors ml-1"
                        title="Configure Lark Webhooks"
                    >
                        <Send className="w-3 h-3" />
                        Webhooks
                    </button>
                </div>
            </div>

            {/* Priority Legend (collapsed) */}
            <div className="flex items-center gap-4 text-[9px] text-zinc-600">
                <span className="font-semibold uppercase tracking-wider">Priority:</span>
                <div className="flex items-center gap-1">
                    <PlayCircle className="w-2.5 h-2.5 text-blue-500" />
                    <span>Doing</span>
                </div>
                <ArrowRight className="w-2.5 h-2.5" />
                <div className="flex items-center gap-1">
                    <Hand className="w-2.5 h-2.5 text-amber-500" />
                    <span>Blocking</span>
                </div>
                <ArrowRight className="w-2.5 h-2.5" />
                <div className="flex items-center gap-1">
                    <UserX className="w-2.5 h-2.5 text-red-500" />
                    <span>Blocked</span>
                </div>
                <ArrowRight className="w-2.5 h-2.5" />
                <div className="flex items-center gap-1">
                    <AlertTriangle className="w-2.5 h-2.5 text-orange-500" />
                    <span>No Activity</span>
                </div>
                <ArrowRight className="w-2.5 h-2.5" />
                <div className="flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5 text-zinc-500" />
                    <span>Pending</span>
                </div>
            </div>

            {/* Main Content */}
            {personData.length === 0 ? (
                <div className="text-center py-12 text-zinc-500">
                    <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No active tasks found for the current sprint</p>
                </div>
            ) : filteredPersonData.length === 0 ? (
                <div className="text-center py-12 text-zinc-500">
                    <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No one has tasks in the selected categories. Turn on more filters.</p>
                </div>
            ) : viewMode === 'all' ? (
                <AllPersonsView
                    personData={filteredPersonData}
                    categoryFilter={categoryFilter}
                    highRiskIds={highRiskIds}
                    onTaskClick={onTaskClick}
                    meetingNotes={meetingNotes}
                />
            ) : viewMode === 'squads' ? (
                <SquadsView
                    analyses={analyses}
                    categoryFilter={categoryFilter}
                    highRiskIds={highRiskIds}
                    onTaskClick={onTaskClick}
                    meetingNotes={meetingNotes}
                    dailyTodos={dailyTodos}
                    selectedDate={selectedDate}
                    allPersonData={personData}
                    roles={roles}
                    activeSprint={activeSprint}
                />
            ) : showCompare && currentPersonData ? (
                <CompareView
                    personData={currentPersonData}
                    analyses={analyses}
                    highRiskIds={highRiskIds}
                    onTaskClick={onTaskClick}
                    dailyTodos={dailyTodos}
                    rawLogs={rawLogs}
                />
            ) : showHistory && currentPersonData ? (
                <HistoricalView
                    personData={currentPersonData}
                    analyses={analyses}
                    highRiskIds={highRiskIds}
                    onTaskClick={onTaskClick}
                    dailyTodos={dailyTodos}
                />
            ) : currentPersonData ? (
                <PersonSingleView
                    personData={currentPersonData}
                    categoryFilter={categoryFilter}
                    analyses={analyses}
                    highRiskIds={highRiskIds}
                    onTaskClick={onTaskClick}
                    selectedDate={selectedDate}
                    dailyTodos={dailyTodos}
                    rawLogs={rawLogs}
                    sprintStartSnapshot={sprintStartSnapshot}
                    allPersonData={personData}
                    meetingNotes={meetingNotes}
                    activeSprint={activeSprint}
                />
            ) : null}

            {/* Member Roles Settings Modal */}
            {rolesModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
                    <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-xl p-5 shadow-2xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
                                <Users className="w-5 h-5 text-indigo-400" />
                                Member Roles Settings
                            </h3>
                            <button onClick={() => setRolesModalOpen(false)} className="text-zinc-500 hover:text-zinc-200">
                                Close
                            </button>
                        </div>
                        <p className="text-xs text-zinc-400 mb-4">
                            Assign roles to members. This affects sorting in squad views and priority grouping in blocked-by dropdowns.
                        </p>
                        <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                            {personData.map(p => (
                                <div key={p.person} className="flex items-center justify-between bg-zinc-900/50 p-2.5 rounded-lg border border-zinc-800/80">
                                    <span className="text-sm font-medium text-zinc-200">{p.person}</span>
                                    <select
                                        value={roles[p.person] || ''}
                                        onChange={(e) => updateRole(p.person, e.target.value)}
                                        className="bg-zinc-950 border border-zinc-700 rounded-md px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    >
                                        <option value="">No Role</option>
                                        {ROLE_ORDER.filter(r => r !== 'Other').map(role => (
                                            <option key={role} value={role}>{role}</option>
                                        ))}
                                    </select>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <WebhookSettingsModal
                isOpen={webhooksModalOpen}
                onClose={() => setWebhooksModalOpen(false)}
                persons={personData.map(p => p.person)}
                initialPerson={selectedPerson}
            />
        </div>
    );
}
