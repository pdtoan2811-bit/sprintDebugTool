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
    X,
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
import { computePersonMeetingData, getVisibleTaskCount, formatCorporateName, ACTIVE_STATUSES, formatTodoListForDM, formatTodoListForWebhook, sendTodoListToWebhook, getLatestMeetingNote } from './daily-meeting/utils';
import { priorityDotColor, StatusBadge } from '@/lib/status-utils';
import { PersonSingleView } from './daily-meeting/PersonSingleView';
import { HistoricalView } from './daily-meeting/HistoricalView';
import { CompareView } from './daily-meeting/CompareView';
import { TaskCard } from './TaskCard';

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
            doing: 'bg-blue-50/50 border-blue-100 text-[#1D3557] hover:bg-blue-100/50 transition-all',
            blocking: 'bg-amber-50/50 border-amber-100 text-amber-900 hover:bg-amber-100/50 transition-all',
            blocked: 'bg-red-50/50 border-red-100 text-red-900 hover:bg-red-100/50 transition-all',
            notStarted: 'bg-secondary/40 border-border/50 text-foreground/80 hover:bg-secondary/60 transition-all',
        };

        return (
            <button
                key={task.taskId}
                onClick={() => onTaskClick(task.taskId)}
                className={`w-full text-left px-3 py-2 rounded-xl border flex items-center gap-3 transition-all active:scale-[0.98] group ${colorClasses[colorScheme]}`}
            >
                <div className={`w-2 h-2 rounded-full shrink-0 ${priorityDotColor(task.currentStatus)} shadow-sm`} />
                {isHighRisk && (
                    <div className="w-5 h-5 flex items-center justify-center bg-rose-500 rounded-full shrink-0 shadow-sm">
                        <span className="text-[10px] text-white font-bold">!</span>
                    </div>
                )}
                <span className="text-[11px] font-bold font-mono text-muted-foreground/60 group-hover:text-foreground/70 transition-colors tracking-tight">{task.taskId}</span>
                <span className="text-[11px] font-bold truncate flex-1 leading-tight">{task.taskName}</span>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-foreground/50 transition-all group-hover:translate-x-0.5" />
            </button>
        );
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {personData.map((data) => {
                const hasBlocking = data.categories.blockingOthers.length > 0;
                const hasBlocked = data.categories.blockedByOthers.length > 0;
                const hasDoing = data.categories.doing.length > 0;

                return (
                    <div
                        key={data.person}
                        className={`rounded-xl border p-4 transition-all hover:shadow-xl group/card ${
                            hasBlocking
                                ? 'border-amber-300/40 bg-amber-50/20 dark:border-amber-700/30 dark:bg-amber-950/5 shadow-lg shadow-amber-500/5'
                                : hasBlocked
                                    ? 'border-rose-300/40 bg-rose-50/20 dark:border-rose-700/30 dark:bg-rose-950/5 shadow-lg shadow-rose-500/5'
                                    : hasDoing
                                        ? 'border-blue-300/40 bg-blue-50/20 dark:border-blue-700/30 dark:bg-blue-950/5 shadow-lg shadow-blue-500/5'
                                        : 'border-border bg-card shadow-sm'
                        }`}
                    >
                        <div className="flex items-center justify-between mb-4 pb-3 border-b border-border/50">
                            <div className="flex items-center gap-4">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-[11px] font-bold shadow-sm transition-transform group-hover/card:scale-110 ${
                                    hasBlocking ? 'bg-amber-500 text-white shadow-amber-200' :
                                    hasBlocked ? 'bg-rose-500 text-white shadow-rose-200' :
                                    hasDoing ? 'bg-[#1D3557] text-white shadow-blue-200' : 'bg-secondary text-muted-foreground'
                                }`}>
                                    {data.person.substring(0, 2).toUpperCase()}
                                </div>
                                <div>
                                    <h3 className="font-bold text-foreground tracking-tight text-sm leading-none">{data.person}</h3>
                                    <p className="text-[10px] font-bold text-muted-foreground/50 mt-1 tracking-tight">{data.totalTasks} Total Objectives</p>
                                </div>
                            </div>
                            <div className="flex -space-x-1.5">
                                {hasBlocking && <div className="w-2.5 h-2.5 rounded-full bg-amber-500 border-2 border-white dark:border-black shadow-sm z-10" />}
                                {hasBlocked && <div className="w-2.5 h-2.5 rounded-full bg-rose-500 border-2 border-white dark:border-black shadow-sm z-20" />}
                                {hasDoing && <div className="w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-white dark:border-black shadow-sm z-30" />}
                            </div>
                        </div>

                        <div className="space-y-4">
                            {(['doing', 'blockingOthers', 'blockedByOthers', 'notStarted', 'other'] as const).map(key => {
                                const categoryKey = key === 'notStarted' ? 'notStartedInSprint' : key;
                                const tasks = data.categories[categoryKey];
                                if (!categoryFilter[key] || tasks.length === 0) return null;

                                const colors = {
                                    doing: 'text-blue-600 dark:text-blue-400',
                                    blockingOthers: 'text-amber-600 dark:text-amber-400',
                                    blockedByOthers: 'text-rose-600 dark:text-rose-400',
                                    notStarted: 'text-foreground/40',
                                    other: 'text-foreground/40'
                                };

                                const icons = {
                                    doing: <PlayCircle className="w-3.5 h-3.5" />,
                                    blockingOthers: <Hand className="w-3.5 h-3.5" />,
                                    blockedByOthers: <UserX className="w-3.5 h-3.5" />,
                                    notStarted: <AlertTriangle className="w-3.5 h-3.5 opacity-30" />,
                                    other: <Clock className="w-3.5 h-3.5 opacity-30" />
                                };

                                const labels = {
                                    doing: 'In Progress',
                                    blockingOthers: 'Blocking Others',
                                    blockedByOthers: 'Impeded',
                                    notStarted: 'Stale / No Activity',
                                    other: 'Awaiting Action'
                                };

                                return (
                                    <div key={key} className="space-y-2">
                                        <div className={`flex items-center gap-2 px-1 ${colors[key]}`}>
                                            {icons[key]}
                                            <span className="text-[11px] font-bold tracking-tight">{labels[key]}</span>
                                            <div className="h-px flex-1 bg-current opacity-20 ml-1" />
                                            <span className="text-[11px] font-bold opacity-60 ml-1">{tasks.length}</span>
                                        </div>
                                        <div className="space-y-1 px-0.5">
                                            {tasks.map((task) => renderTaskButton(task, key === 'blockingOthers' ? 'blocking' : key === 'blockedByOthers' ? 'blocked' : key === 'doing' ? 'doing' : 'notStarted'))}
                                        </div>
                                    </div>
                                );
                            })}
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

    const { combinationBacklogs, individualBacklog } = useMemo(() => {
        if (squadMembers.length === 0) return { combinationBacklogs: [], individualBacklog: {} as Record<string, TaskAnalysis[]> };

        const combinations = new Map<string, TaskAnalysis[]>();
        const individual: Record<string, TaskAnalysis[]> = {};
        squadMembers.forEach(sm => individual[sm] = []);

        const uncompletedTasks: TaskAnalysis[] = [];
        Object.values(analyses).forEach(task => {
            if (task.currentStatus === 'Completed') return;
            if (activeSprint && String(task.sprint) !== String(activeSprint)) return;
            uncompletedTasks.push(task);
        });

        uncompletedTasks.forEach(task => {
            const assignees = task.currentPerson ? task.currentPerson.split(',').map(p => p.trim()).filter(Boolean) : [];
            const involved = squadMembers.filter(sm => assignees.includes(sm));
            if (involved.length === 0) return;
            const isFullyPlanned = involved.every(sm => {
                const todos = dailyTodos.getTodosForPersonDate(sm, dateStr);
                return todos.some(todo => todo.taskId === task.taskId);
            });
            if (isFullyPlanned) return;
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
            return { involvedList: key.split('|'), tasks };
        });

        combinationArray.sort((a, b) => {
            if (a.involvedList.length !== b.involvedList.length) return b.involvedList.length - a.involvedList.length;
            return a.involvedList.join(',').localeCompare(b.involvedList.join(','));
        });

        Object.keys(individual).forEach(key => individual[key].sort((a, b) => b.staleDurationMs - a.staleDurationMs));
        return { combinationBacklogs: combinationArray, individualBacklog: individual };
    }, [analyses, squadMembers, activeSprint, dailyTodos, dateStr]);

    const { combinationPlans, individualPlans } = useMemo(() => {
        const combinations = new Map<string, { task: TaskAnalysis, plannedBy: Set<string>, involved: string[] }>();
        const individual: Record<string, { task: TaskAnalysis, completedAt?: string }[]> = {};
        squadMembers.forEach(sm => individual[sm] = []);
        squadMembers.forEach(sm => {
            const todos = dailyTodos.getTodosForPersonDate(sm, dateStr);
            todos.forEach(todo => {
                const task = analyses[todo.taskId];
                if (!task || (activeSprint && String(task.sprint) !== String(activeSprint))) return;
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
                    if (!individual[sm].some(t => t.task.taskId === task.taskId)) individual[sm].push({ task, completedAt: todo.completedAt });
                }
            });
        });

        const groupedMap = new Map<string, { task: TaskAnalysis, plannedBy: Set<string>, involved: string[] }[]>();
        combinations.forEach((data) => {
            const key = data.involved.join('|');
            if (!groupedMap.has(key)) groupedMap.set(key, []);
            groupedMap.get(key)!.push(data);
        });

        const combinationArray = Array.from(groupedMap.entries()).map(([key, items]) => ({ involvedList: key.split('|'), items }));
        combinationArray.sort((a, b) => {
            if (a.involvedList.length !== b.involvedList.length) return b.involvedList.length - a.involvedList.length;
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

    const handleDragLeave = () => setDragOverTodo(false);

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
                    if (!todos.some(t => t.taskId === taskId)) dailyTodos.addTodo(sm, dateStr, taskId);
                });
            } else if (squadMembers.length === 1) {
                 const todos = dailyTodos.getTodosForPersonDate(squadMembers[0], dateStr);
                 if (!todos.some(t => t.taskId === taskId)) dailyTodos.addTodo(squadMembers[0], dateStr, taskId);
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
                return { text: 'In bottleneck', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', icon: <AlertTriangle className="w-2.5 h-2.5" /> };
            }
            if (ACTIVE_STATUSES.has(task.currentStatus)) {
                return { text: 'Active', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300', icon: <PlayCircle className="w-2.5 h-2.5" /> };
            }
            if (task.currentStatus === 'Not Started') {
                return { text: 'Not started', color: 'bg-secondary text-muted-foreground', icon: <Circle className="w-2.5 h-2.5" /> };
            }
            return undefined;
        };

        const onQuickAdd = () => {
            const assignees = task.currentPerson ? task.currentPerson.split(',').map(p => p.trim()) : [];
            const involved = squadMembers.filter(m => assignees.includes(m));
            if (involved.length > 0) involved.forEach(sm => dailyTodos.addTodo(sm, dateStr, task.taskId));
            else if (squadMembers.length === 1) dailyTodos.addTodo(squadMembers[0], dateStr, task.taskId);
        };

        const onRemove = () => {
            if (isSharedPlan && sharedPlanData) sharedPlanData.plannedBy.forEach(sm => dailyTodos.removeTodo(sm, dateStr, task.taskId));
            else if (member) dailyTodos.removeTodo(member, dateStr, task.taskId);
        };

        const onToggle = () => {
            if (isSharedPlan && sharedPlanData) sharedPlanData.plannedBy.forEach(sm => dailyTodos.toggleTodoComplete(sm, dateStr, task.taskId));
            else if (member) dailyTodos.toggleTodoComplete(member, dateStr, task.taskId);
        };

        return (
            <div key={task.taskId} className="relative group/card">
                <TaskCard
                    task={task}
                    isHighRisk={highRiskIds.has(task.taskId)}
                    onTaskClick={onTaskClick}
                    isDraggable={context === 'backlog'}
                    onDragStart={handleDragStart}
                    isInTodoList={context === 'plan'}
                    todoCompleted={completed}
                    showSprintGoal={context === 'plan'}
                    showMetadata={true}
                    onRemoveFromTodo={onRemove}
                    onToggleComplete={onToggle}
                    categoryLabel={getCategoryLabel()}
                    actions={
                        context === 'backlog' ? (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onQuickAdd();
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1D3557] hover:bg-[#1D3557]/90 text-white text-[10px] font-bold transition-all shadow-lg shadow-[#1D3557]/20 active:scale-95 ml-1"
                                title="Deploy to daily plan"
                            >
                                <Plus className="w-3 h-3" />
                                Deploy
                            </button>
                        ) : null
                    }
                />
            </div>
        );
    };

    return (
        <div className="space-y-4 flex flex-col min-h-[500px] animate-in fade-in duration-500">
            {/* Personnel Selector Row */}
            <div className="bg-card p-4 rounded-xl border border-border flex flex-col gap-3 flex-shrink-0 shadow-2xl shadow-indigo-500/5 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-3xl -mr-16 -mt-16 group-hover:bg-indigo-500/10 transition-all duration-700" />
                <div className="flex items-center gap-3 relative">
                    <div className="p-1.5 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-600/20">
                        <Users className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold tracking-tight text-foreground">Personnel Assembly</h3>
                        <p className="text-[10px] font-medium text-muted-foreground/50 mt-1">Form the collaborative squad context for synchronization.</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 overflow-x-auto pb-1 px-1 custom-scrollbar relative">
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
                                className={`flex-shrink-0 flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-all active:scale-95 ${
                                    isSelected 
                                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-xl shadow-indigo-600/30'
                                        : 'bg-secondary/40 border-border/50 text-muted-foreground hover:bg-secondary hover:text-foreground shadow-sm'
                                }`}
                            >
                                <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white shadow-lg animate-pulse' : 'bg-muted-foreground/30'}`} />
                                <span className="text-xs font-bold tracking-tight">{p.person}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {selectedPersonsFilter.size === 0 ? (
                <div className="flex-1 flex items-center justify-center rounded-xl border border-dashed border-border/60 bg-secondary/10 animate-pulse">
                    <div className="text-center py-20 px-8 max-w-sm">
                        <div className="w-20 h-20 bg-indigo-500/5 rounded-full flex items-center justify-center mx-auto mb-8">
                            <Users className="w-10 h-10 text-indigo-500/20" />
                        </div>
                        <h3 className="text-foreground/50 font-bold text-sm mb-4 tracking-tight">Zero Context Initialized</h3>
                        <p className="text-xs font-medium text-muted-foreground/40 leading-relaxed">
                            Initialize the squad cluster by selecting personnel from the assembly terminal above.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 flex-1 min-h-0">
                    {/* Left Column: Squad Backlog */}
                    <div className="rounded-xl border border-border bg-secondary/10 shadow-2xl shadow-zinc-500/5 p-5 flex flex-col min-h-0 overflow-hidden" style={{ maxHeight: '75vh' }}>
                        <div className="flex items-center justify-between mb-5 pb-3 border-b border-border/50 flex-shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-600">
                                    <Layers className="w-5 h-5 font-bold" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold tracking-tight text-foreground leading-none">Global Backlog</h3>
                                    <p className="text-[10px] font-bold text-muted-foreground/40 mt-1 tracking-tight">Available Objectives: {combinationBacklogs.reduce((sum, g) => sum + g.tasks.length, 0) + squadMembers.reduce((sum, m) => sum + individualBacklog[m].length, 0)}</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-indigo-50/40 dark:bg-indigo-950/10 border border-indigo-100/50 dark:border-indigo-900/30 rounded-xl flex-shrink-0">
                            <GripVertical className="w-4 h-4 text-indigo-500/40" />
                            <span className="text-[10px] font-bold tracking-tight text-indigo-600/70">Interactive Transfer: Drag to Sync Protocol</span>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-3 space-y-5 pb-5">
                            {combinationBacklogs.map(group => (
                                <div key={group.involvedList.join('|')} className="space-y-3">
                                    <div className="flex items-center gap-3 text-indigo-600 border-b border-indigo-100/50 pb-2">
                                        <Users className="w-4 h-4" />
                                        <h4 className="text-[13px] font-bold tracking-tight">
                                            {group.involvedList.length === squadMembers.length 
                                                ? `Squad Collective (${group.tasks.length})`
                                                : `Collaborative: ${group.involvedList.join(', ')} (${group.tasks.length})`}
                                        </h4>
                                    </div>
                                    <div className="space-y-2 pl-3 border-l-2 border-indigo-500/10">
                                        {group.tasks.map(task => renderCard(task, 'backlog'))}
                                    </div>
                                </div>
                            ))}

                            {squadMembers.map(member => {
                                const tasks = individualBacklog[member] || [];
                                if (tasks.length === 0) return null;
                                return (
                                    <div key={member} className="space-y-3">
                                        <div className="flex items-center gap-3 text-muted-foreground border-b border-border/50 pb-2">
                                            <User className="w-4 h-4" />
                                            <h4 className="text-[11px] font-black uppercase tracking-[0.15em]">{member} Individual ({tasks.length})</h4>
                                        </div>
                                        <div className="space-y-2 pl-3 border-l-2 border-border/40">
                                            {tasks.map(task => renderCard(task, 'backlog', member))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right Column: Squad Plan */}
                    <div 
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`rounded-xl border p-5 flex flex-col min-h-0 overflow-hidden transition-all duration-500 ${
                            dragOverTodo
                                ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20 translate-y-[-4px] shadow-2xl shadow-indigo-500/20'
                                : 'border-border bg-secondary/30 shadow-2xl shadow-zinc-500/5'
                        }`}
                        style={{ maxHeight: '75vh' }}
                    >
                        <div className="flex items-center justify-between mb-5 pb-3 border-b border-border/50 flex-shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-600">
                                    <Calendar className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-foreground leading-none flex items-center gap-2">
                                        Active Sync Protocol
                                        <span className="text-[8px] bg-emerald-500 text-white px-1 rounded">V2</span>
                                    </h3>
                                    <p className="text-[10px] font-bold text-muted-foreground/50 mt-1 uppercase tracking-widest">{isToday(selectedDate) ? "Today" : format(selectedDate, 'MMM d')}'s Deployment Vector</p>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-1.5">
                                <button
                                    onClick={handleCopyForDM}
                                    className={`p-2 rounded-xl border transition-all active:scale-90 ${
                                        copied ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg' : 'bg-secondary/40 border-border/50 text-muted-foreground/60 hover:bg-secondary hover:text-foreground'
                                    }`}
                                    title="Copy Assembly Code"
                                >
                                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                </button>
                                <button
                                    onClick={handleSendToWebhook}
                                    disabled={sending}
                                    className={`p-2 rounded-xl border transition-all active:scale-90 ${
                                        sending ? 'bg-indigo-600 text-white animate-pulse' : 
                                        sendResult ? (sendResult.success ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-rose-600 border-rose-500 text-white') :
                                        'bg-indigo-600 border-indigo-500 text-white shadow-xl shadow-indigo-600/20 hover:bg-indigo-700'
                                    }`}
                                >
                                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        {dragOverTodo && (
                            <div className="flex items-center justify-center py-6 mb-5 rounded-xl border-2 border-dashed border-indigo-500/40 bg-indigo-500/5 flex-shrink-0 animate-in zoom-in-95 duration-300">
                                <div className="flex flex-col items-center gap-3">
                                    <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-xl">
                                        <Plus className="w-6 h-6 text-white" />
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600">Commit to Plan</span>
                                </div>
                            </div>
                        )}

                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-3 space-y-5 pb-5">
                             {combinationPlans.map(group => (
                                <div key={group.involvedList.join('|')} className="space-y-3">
                                    <div className="flex items-center gap-3 text-emerald-600 border-b border-emerald-100/50 pb-2">
                                        <Users className="w-4 h-4" />
                                        <h4 className="text-[11px] font-black uppercase tracking-[0.15em]">
                                            {group.involvedList.length === squadMembers.length 
                                                ? `Collective Objectives`
                                                : `Shared: ${group.involvedList.join(', ')}`}
                                        </h4>
                                    </div>
                                    <div className="space-y-2 pl-3 border-l-2 border-emerald-500/10">
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

                            {squadMembers.map(member => {
                                const plans = individualPlans[member] || [];
                                if (plans.length === 0) return null;
                                return (
                                    <div key={member} className="space-y-3">
                                        <div className="flex items-center gap-3 text-emerald-600/70 border-b border-emerald-100/50 pb-2">
                                            <User className="w-4 h-4" />
                                            <h4 className="text-[11px] font-black uppercase tracking-[0.15em]">{member} Objectives</h4>
                                        </div>
                                        <div className="space-y-2 pl-3 border-l-2 border-emerald-500/10">
                                            {plans.map(p => renderCard(p.task, 'plan', member, !!p.completedAt, false))}
                                        </div>
                                    </div>
                                );
                            })}
                            
                            {combinationPlans.length === 0 && squadMembers.every(m => individualPlans[m].length === 0) && !dragOverTodo && (
                                <div className="text-center py-12 bg-secondary/20 rounded-xl border border-dashed border-border/60">
                                    <Calendar className="w-10 h-10 mx-auto mb-4 opacity-10 text-emerald-500" />
                                    <h5 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/30 leading-relaxed italic">
                                        The mission plan remains unpopulated.<br/>Select and drag objectives to initialize.
                                    </h5>
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
        if (!selectedPerson && filteredPersonData.length > 0) return filteredPersonData[0];
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
        <div className="space-y-5 animate-in fade-in duration-700">
            {/* Control Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-border/50 bg-background/50 backdrop-blur-xl sticky top-0 z-[60] py-2">
                <div className="flex items-center gap-4">
                    {/* View Mode Toggle */}
                    <div className="flex bg-secondary/60 p-0.5 rounded-xl border border-border/50 shadow-inner">
                        {[
                            { id: 'single', name: 'Personnel', icon: <User className="w-3.5 h-3.5" /> },
                            { id: 'all', name: 'Fleet View', icon: <Users className="w-3.5 h-3.5" /> },
                            { id: 'squads', name: 'Squad Ops', icon: <Layers className="w-3.5 h-3.5" /> }
                        ].map(mode => (
                            <button
                                key={mode.id}
                                onClick={() => setViewMode(mode.id as any)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                    viewMode === mode.id
                                        ? 'bg-card text-foreground shadow-lg scale-105'
                                        : 'text-muted-foreground/50 hover:text-foreground/70'
                                }`}
                            >
                                {mode.icon}
                                <span className="hidden sm:inline">{mode.name}</span>
                            </button>
                        ))}
                    </div>

                    {/* Person Selector (only in single mode) */}
                    {viewMode === 'single' && currentPersonData && (
                        <div className="relative">
                            <button
                                onClick={() => setPersonDropdownOpen(!personDropdownOpen)}
                                className="flex items-center gap-3 px-5 py-3 rounded-2xl border border-border/80 bg-card hover:border-indigo-500/50 hover:bg-secondary/20 transition-all shadow-sm group"
                            >
                                <div className={`w-2.5 h-2.5 rounded-full shrink-0 shadow-sm ${
                                    currentPersonData.categories.blockingOthers.length > 0 ? 'bg-amber-500 animate-pulse' :
                                    currentPersonData.categories.blockedByOthers.length > 0 ? 'bg-rose-500 animate-pulse' : 'bg-blue-500'
                                }`} />
                                <span className="text-xs font-black uppercase tracking-tight text-foreground truncate max-w-[120px]">{currentPersonData.person}</span>
                                <ChevronDown className={`w-4 h-4 text-muted-foreground/40 transition-transform duration-300 ${personDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {personDropdownOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setPersonDropdownOpen(false)} />
                                    <div className="absolute top-full left-0 mt-3 w-72 max-h-[25rem] overflow-y-auto custom-scrollbar rounded-3xl border border-border/80 bg-card shadow-2xl z-50 p-2 animate-in slide-in-from-top-2 duration-300">
                                        {filteredPersonData.map((p) => (
                                            <button
                                                key={p.person}
                                                onClick={() => { setSelectedPerson(p.person); setPersonDropdownOpen(false); }}
                                                className={`w-full flex items-center gap-3 px-4 py-3 text-left rounded-2xl hover:bg-secondary/50 transition-all group ${p.person === currentPersonData.person ? 'bg-secondary/30' : ''}`}
                                            >
                                                <div className={`w-2 h-2 rounded-full shrink-0 ${
                                                    p.categories.blockingOthers.length > 0 ? 'bg-amber-500' :
                                                    p.categories.blockedByOthers.length > 0 ? 'bg-rose-500' :
                                                    p.categories.doing.length > 0 ? 'bg-blue-500' : 'bg-muted-foreground/30'
                                                }`} />
                                                <span className="text-xs font-bold text-foreground flex-1 uppercase tracking-tight">{p.person}</span>
                                                <div className="flex items-center gap-1.5">
                                                    {p.categories.blockingOthers.length > 0 && <span className="text-[9px] font-black px-1.5 py-0.5 rounded-lg bg-amber-500/10 text-amber-600">!</span>}
                                                    <span className="text-[10px] font-black text-muted-foreground/30 font-mono">{p.totalTasks}</span>
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
                            onClick={() => { setShowCompare(!showCompare); if (!showCompare) setShowHistory(false); }}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${
                                showCompare ? 'bg-indigo-600 border-indigo-500 text-white shadow-xl shadow-indigo-600/30' : 'bg-card text-muted-foreground/60 hover:text-foreground border-border/60 hover:border-indigo-500/50'
                            }`}
                        >
                            <GitCompare className="w-3.5 h-3.5" />
                            Compare
                        </button>
                        <button
                            onClick={() => { setShowHistory(!showHistory); if (!showHistory) setShowCompare(false); }}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${
                                showHistory ? 'bg-indigo-600 border-indigo-500 text-white shadow-xl shadow-indigo-600/30' : 'bg-card text-muted-foreground/60 hover:text-foreground border-border/60 hover:border-indigo-500/50'
                            }`}
                        >
                            <History className="w-3.5 h-3.5" />
                            History
                        </button>

                        {!showHistory && !showCompare && (
                            <div className="flex items-center gap-1 rounded-2xl border border-border/50 bg-secondary/40 p-1 shrink-0 ml-2">
                                <button onClick={() => navigateDate('prev')} className="p-2.5 rounded-xl hover:bg-card text-muted-foreground/40 hover:text-foreground transition-all active:scale-90"><ChevronLeft className="w-4 h-4" /></button>
                                <button onClick={() => setSelectedDate(new Date())} className={`px-5 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${isToday(selectedDate) ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground/40 hover:bg-card hover:text-foreground'}`}>
                                    {isToday(selectedDate) ? 'Live' : format(selectedDate, 'MMM d')}
                                </button>
                                <button onClick={() => navigateDate('next')} disabled={isToday(selectedDate)} className="p-2.5 rounded-xl hover:bg-card text-muted-foreground/40 hover:text-foreground transition-all disabled:opacity-30 disabled:grayscale active:scale-90"><ChevronRight className="w-4 h-4" /></button>
                            </div>
                        )}
                    </div>
                )}

                {/* Performance Filter & Stats Summary Container */}
                <div className="flex items-center gap-6 flex-wrap">
                    <div className="flex items-center gap-2 bg-secondary/40 p-1 rounded-2xl border border-border/50 shrink-0">
                        {(['doing', 'blockedByOthers', 'blockingOthers', 'notStarted', 'other'] as const).map((key) => {
                            const labelMap = { doing: 'Active', blockedByOthers: 'Impeded', blockingOthers: 'Blocking', notStarted: 'Stale', other: 'Queued' };
                            const colors = { 
                                doing: 'bg-blue-100/80 text-blue-700 border-blue-200 shadow-sm dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800', 
                                blockedByOthers: 'bg-rose-100/80 text-rose-700 border-rose-200 shadow-sm dark:bg-rose-900/50 dark:text-rose-300 dark:border-rose-800', 
                                blockingOthers: 'bg-amber-100/80 text-amber-700 border-amber-200 shadow-sm dark:bg-amber-900/50 dark:text-amber-300 dark:border-amber-800', 
                                notStarted: 'bg-orange-100/80 text-orange-700 border-orange-200 shadow-sm dark:bg-orange-900/50 dark:text-orange-300 dark:border-orange-800', 
                                other: 'bg-secondary border-border text-foreground/60 shadow-sm' 
                            };
                            return (
                                <button
                                    key={key}
                                    onClick={() => setCategoryFilter((prev) => ({ ...prev, [key]: !prev[key] }))}
                                    className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-[0.98] border ${
                                        categoryFilter[key] ? colors[key] : 'border-transparent text-muted-foreground/40 hover:text-foreground/60'
                                    }`}
                                >
                                    {labelMap[key]}
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex items-center gap-4 bg-card border border-border/80 px-5 py-3 rounded-2xl shadow-sm italic text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground/40 leading-none">
                        Configuration:
                        <button onClick={() => setRolesModalOpen(true)} className="flex items-center gap-2 hover:text-indigo-600 transition-colors">
                            <Settings className="w-3.5 h-3.5" />
                            Roles
                        </button>
                        <div className="w-px h-3 bg-border/50" />
                        <button onClick={() => setWebhooksModalOpen(true)} className="flex items-center gap-2 hover:text-indigo-600 transition-colors">
                            <Send className="w-3.5 h-3.5" />
                            Registry
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="min-h-[60vh]">
            {personData.length === 0 ? (
                <div className="text-center py-20 bg-secondary/10 rounded-[3rem] border border-dashed border-border/50">
                    <div className="w-20 h-20 bg-muted/20 rounded-full flex items-center justify-center mx-auto mb-8">
                        <AlertTriangle className="w-10 h-10 text-muted-foreground/20" />
                    </div>
                    <h3 className="text-muted-foreground/40 font-black uppercase tracking-[0.2em] text-sm mb-4">Initial State: No Records Available</h3>
                    <p className="text-xs font-bold text-muted-foreground/30 italic">Synchronize the dataset to initialize the meeting diagnostics protocol.</p>
                </div>
            ) : filteredPersonData.length === 0 ? (
                <div className="text-center py-20 bg-secondary/10 rounded-[3rem] border border-dashed border-border/50">
                    <div className="w-20 h-20 bg-muted/20 rounded-full flex items-center justify-center mx-auto mb-8">
                        <AlertTriangle className="w-10 h-10 text-muted-foreground/20" />
                    </div>
                    <h3 className="text-muted-foreground/40 font-black uppercase tracking-[0.2em] text-sm mb-4">No Data in Filter Scope</h3>
                    <p className="text-xs font-bold text-muted-foreground/30 italic">Broaden the telemetry filters to visualize current operations.</p>
                </div>
            ) : viewMode === 'all' ? (
                <AllPersonsView personData={filteredPersonData} categoryFilter={categoryFilter} highRiskIds={highRiskIds} onTaskClick={onTaskClick} meetingNotes={meetingNotes} />
            ) : viewMode === 'squads' ? (
                <SquadsView analyses={analyses} categoryFilter={categoryFilter} highRiskIds={highRiskIds} onTaskClick={onTaskClick} meetingNotes={meetingNotes} dailyTodos={dailyTodos} selectedDate={selectedDate} allPersonData={personData} roles={roles} activeSprint={activeSprint} />
            ) : showCompare && currentPersonData ? (
                <CompareView personData={currentPersonData} analyses={analyses} highRiskIds={highRiskIds} onTaskClick={onTaskClick} dailyTodos={dailyTodos} rawLogs={rawLogs} />
            ) : showHistory && currentPersonData ? (
                <HistoricalView personData={currentPersonData} analyses={analyses} highRiskIds={highRiskIds} onTaskClick={onTaskClick} dailyTodos={dailyTodos} />
            ) : currentPersonData ? (
                <PersonSingleView personData={currentPersonData} categoryFilter={categoryFilter} analyses={analyses} highRiskIds={highRiskIds} onTaskClick={onTaskClick} selectedDate={selectedDate} dailyTodos={dailyTodos} rawLogs={rawLogs} sprintStartSnapshot={sprintStartSnapshot} allPersonData={personData} meetingNotes={meetingNotes} activeSprint={activeSprint} />
            ) : null}
            </div>

            {/* Member Roles Settings Modal */}
            {rolesModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-6 animate-in fade-in duration-300">
                    <div className="w-full max-w-xl bg-card border border-border rounded-[2.5rem] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="flex justify-between items-center p-8 border-b border-border/50 bg-secondary/20">
                            <div className="flex items-center gap-4">
                                <div className="p-2.5 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-600/20">
                                    <Users className="w-5 h-5 text-white" />
                                </div>
                                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-foreground">Hierarchy Configuration</h3>
                            </div>
                            <button onClick={() => setRolesModalOpen(false)} className="p-2 hover:bg-secondary rounded-xl text-muted-foreground/40 hover:text-foreground transition-all active:scale-95">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-4">
                            <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/10 border border-indigo-100/50 dark:border-indigo-900/30 rounded-2xl mb-4">
                                <p className="text-[10px] font-bold text-indigo-600/70 italic leading-relaxed">
                                    Define the operational status of personnel. Roles prioritize synchronization hierarchy in the Squad Core and telemetry sorting.
                                </p>
                            </div>
                            <div className="grid gap-3">
                                {personData.map(p => (
                                    <div key={p.person} className="flex items-center justify-between bg-secondary/30 p-4 rounded-2xl border border-border/50 hover:border-indigo-500/30 transition-all group">
                                        <span className="text-xs font-black uppercase tracking-tight text-foreground/70">{p.person}</span>
                                        <select
                                            value={roles[p.person] || ''}
                                            onChange={(e) => updateRole(p.person, e.target.value)}
                                            className="bg-card border border-border rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest text-foreground/80 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 appearance-none cursor-pointer transition-all shadow-sm"
                                        >
                                            <option value="">Status: Unassigned</option>
                                            {ROLE_ORDER.filter(r => r !== 'Other').map(role => (
                                                <option key={role} value={role}>{role}</option>
                                            ))}
                                        </select>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="p-8 border-t border-border/50 flex justify-end bg-secondary/20">
                            <button onClick={() => setRolesModalOpen(false)} className="px-10 py-3 bg-foreground text-background text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-xl shadow-foreground/10 active:scale-95">Commit Hierarchy</button>
                        </div>
                    </div>
                </div>
            )}

            <WebhookSettingsModal isOpen={webhooksModalOpen} onClose={() => setWebhooksModalOpen(false)} persons={personData.map(p => p.person)} initialPerson={selectedPerson} />
        </div>
    );
}
