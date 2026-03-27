import React, { useState, useCallback, useMemo, DragEvent } from 'react';
import { TaskAnalysis, MeetingNote, RawLogEvent } from '@/lib/types';
import { useDailyTodos } from '@/lib/hooks/useDailyTodos';
import { format, isToday } from 'date-fns';
import { Badge } from '../../ui/badge';
import {
    AlertTriangle,
    Calendar,
    Clock,
    Copy,
    GripVertical,
    Hand,
    Layers,
    Loader2,
    PlayCircle,
    Plus,
    Send,
    UserX,
    Users,
    CheckCircle2,
    ChevronRight,
} from 'lucide-react';
import { PersonMeetingData, CategoryFilterKey } from './types';
import {
    formatTodoListForDM,
    formatTodoListForWebhook,
    sendTodoListToWebhook,
    getLatestMeetingNote
} from './utils';
import { TaskCard } from '../TaskCard';

export interface PersonSingleViewProps {
    personData: PersonMeetingData;
    categoryFilter: Record<CategoryFilterKey, boolean>;
    analyses: Record<string, TaskAnalysis>;
    highRiskIds: Set<string>;
    onTaskClick: (taskId: string) => void;
    selectedDate: Date;
    dailyTodos: ReturnType<typeof useDailyTodos>;
    rawLogs: RawLogEvent[];
    sprintStartSnapshot: Record<string, string>;
    allPersonData: PersonMeetingData[];
    meetingNotes: Record<string, MeetingNote[]>;
    activeSprint: string;
}

function taskInVisibleCategory(taskId: string, personData: PersonMeetingData, filter: Record<CategoryFilterKey, boolean>): boolean {
    if (filter.doing && personData.categories.doing.some((t) => t.taskId === taskId)) return true;
    if (filter.blockingOthers && personData.categories.blockingOthers.some((t) => t.taskId === taskId)) return true;
    if (filter.blockedByOthers && personData.categories.blockedByOthers.some((t) => t.taskId === taskId)) return true;
    if (filter.notStarted && personData.categories.notStartedInSprint.some((t) => t.taskId === taskId)) return true;
    if (filter.other && personData.categories.other.some((t) => t.taskId === taskId)) return true;
    return false;
}

export function PersonSingleView({
    personData,
    categoryFilter,
    analyses,
    highRiskIds,
    onTaskClick,
    selectedDate,
    dailyTodos,
    rawLogs,
    sprintStartSnapshot,
    allPersonData,
    meetingNotes,
    activeSprint
}: PersonSingleViewProps) {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const todosForDate = dailyTodos.getTodosForPersonDate(personData.person, dateStr);
    const todoTaskIds = new Set(todosForDate.map((t) => t.taskId));
    
    const [dragOverTodo, setDragOverTodo] = useState(false);
    const [copied, setCopied] = useState(false);
    const [sending, setSending] = useState(false);
    const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);

    const handleCopyForDM = useCallback(() => {
        const text = formatTodoListForDM(personData.person, todosForDate, analyses, meetingNotes, allPersonData);
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    }, [personData.person, todosForDate, analyses, meetingNotes, allPersonData]);

    const handleSendToWebhook = useCallback(async () => {
        if (sending) return;

        setSending(true);
        setSendResult(null);
        
        const payload = formatTodoListForWebhook(
            personData.person,
            dateStr,
            todosForDate,
            analyses,
            meetingNotes,
            allPersonData,
            activeSprint
        );
        
        const result = await sendTodoListToWebhook(payload);
        
        setSending(false);
        setSendResult({
            success: result.success,
            message: result.success ? 'Sent!' : result.error || 'Failed to send',
        });
        
        setTimeout(() => setSendResult(null), 3000);
    }, [sending, personData.person, dateStr, todosForDate, analyses, meetingNotes, allPersonData, activeSprint]);

    const blockingTaskIds = new Set(personData.categories.blockingOthers.map((t) => t.taskId));
    const notStartedTaskIds = new Set(personData.categories.notStartedInSprint.map((t) => t.taskId));
    const otherTaskIds = new Set(personData.categories.other.map((t) => t.taskId));

    const backlogTasks = useMemo(() => {
        const tasks = personData.allTasks.filter(
            (t) => !todoTaskIds.has(t.taskId) && taskInVisibleCategory(t.taskId, personData, categoryFilter)
        );
        return tasks.sort((a, b) => {
            const aIsBlocking = blockingTaskIds.has(a.taskId) ? 1 : 0;
            const bIsBlocking = blockingTaskIds.has(b.taskId) ? 1 : 0;
            const aNoActivity = notStartedTaskIds.has(a.taskId) ? 1 : 0;
            const bNoActivity = notStartedTaskIds.has(b.taskId) ? 1 : 0;
            const aIsOther = otherTaskIds.has(a.taskId) ? 1 : 0;
            const bIsOther = otherTaskIds.has(b.taskId) ? 1 : 0;
            const aScore = aIsBlocking * 10 + aNoActivity * 5 + aIsOther * 3;
            const bScore = bIsBlocking * 10 + bNoActivity * 5 + bIsOther * 3;
            return bScore - aScore;
        });
    }, [personData, todoTaskIds, blockingTaskIds, notStartedTaskIds, otherTaskIds, categoryFilter]);

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
        if (taskId && !todoTaskIds.has(taskId)) {
            dailyTodos.addTodo(personData.person, dateStr, taskId);
        }
    };

    const sortedTodos = [...todosForDate].sort((a, b) => a.order - b.order);

    const hasBlocking = personData.categories.blockingOthers.length > 0;
    const hasBlocked = personData.categories.blockedByOthers.length > 0;
    const hasDoing = personData.categories.doing.length > 0;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
            {/* Left Column: Task Backlog */}
            <div className={`rounded-xl border p-4 flex flex-col shadow-sm transition-all duration-300 relative overflow-hidden ${
                hasBlocking
                    ? 'border-amber-300 bg-amber-50/60 dark:border-amber-800/40 dark:bg-amber-950/20'
                    : hasBlocked
                        ? 'border-rose-300 bg-rose-50/60 dark:border-rose-800/40 dark:bg-rose-950/20'
                        : hasDoing
                            ? 'border-indigo-300 bg-indigo-50/60 dark:border-indigo-800/40 dark:bg-indigo-950/20'
                            : 'border-border bg-secondary/10'
            }`}>
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-border transition-colors">
                    <div className="flex items-center gap-2.5">
                        <div className="p-1.5 rounded-lg bg-indigo-600 shadow-lg shadow-indigo-600/20">
                            <Layers className="w-4 h-4 text-white" />
                        </div>
                        <h3 className="font-bold text-sm tracking-tight text-foreground flex items-center gap-2">
                            Global Backlog
                            <span className="text-[8px] bg-indigo-500 text-white px-1 rounded">V2</span>
                        </h3>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-bold tracking-tight border-border/50 bg-secondary/30">
                        {backlogTasks.length} Available
                    </Badge>
                </div>

                <div className="text-[10px] font-semibold text-muted-foreground/50 mb-3 flex items-center justify-between px-1 tracking-tight">
                    <div className="flex items-center gap-2">
                        <GripVertical className="w-3.5 h-3.5 text-[#1D3557]" />
                        Drag to deploy task
                    </div>
                    <span className="opacity-60">Priority Sorting Active</span>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1.5 pr-1.5">
                    {backlogTasks.map((task) => {
                        const isBlocking = blockingTaskIds.has(task.taskId);
                        const noActivityInSprint = notStartedTaskIds.has(task.taskId);
                        const isOther = otherTaskIds.has(task.taskId);
                        const isDoing = personData.categories.doing.some((t) => t.taskId === task.taskId);
                        const isBlocked = personData.categories.blockedByOthers.some((t) => t.taskId === task.taskId);
                        
                        const getCategoryLabel = () => {
                            if (isBlocking) return { text: 'Blocking others', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', icon: <Hand className="w-2.5 h-2.5" /> };
                            if (isBlocked) return { text: 'Blocked', color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400', icon: <UserX className="w-2.5 h-2.5" /> };
                            if (isDoing) return { text: 'In progress', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400', icon: <PlayCircle className="w-2.5 h-2.5" /> };
                            if (noActivityInSprint) return { text: 'Stale / Delayed', color: 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400', icon: <AlertTriangle className="w-2.5 h-2.5" /> };
                            if (isOther) return { text: 'Pending', color: 'bg-secondary text-muted-foreground/60', icon: <Clock className="w-2.5 h-2.5" /> };
                            return undefined;
                        };
                        
                        const notes = meetingNotes[task.taskId] || [];
                        const latestNote = getLatestMeetingNote(notes);
                        const blockedByLabel =
                            isBlocked && latestNote?.isStall && latestNote.blockedBy && latestNote.blockedBy !== personData.person
                                ? latestNote.blockedBy
                                : isBlocked && task.blockedBy && task.blockedBy !== personData.person
                                    ? task.blockedBy
                                    : undefined;

                        return (
                            <div key={task.taskId} className="relative group/card">
                                <TaskCard
                                    task={task}
                                    isHighRisk={highRiskIds.has(task.taskId)}
                                    onTaskClick={onTaskClick}
                                    isDraggable={true}
                                    onDragStart={handleDragStart}
                                    categoryLabel={getCategoryLabel()}
                                    blockedByLabel={blockedByLabel}
                                    actions={
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                dailyTodos.addTodo(personData.person, dateStr, task.taskId);
                                            }}
                                            className="px-2 py-1.5 rounded-lg bg-[#1D3557]/10 text-[#1D3557] hover:bg-[#1D3557] hover:text-white text-[10px] font-bold transition-all flex items-center border border-[#1D3557]/20 hover:border-[#1D3557] shrink-0 active:scale-95"
                                        >
                                            <Plus className="w-3 h-3 mr-1" /> Add
                                        </button>
                                    }
                                />
                            </div>
                        );
                    })}

                    {backlogTasks.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground/30 bg-secondary/10 rounded-xl border border-dashed border-border/50">
                            <CheckCircle2 className="w-8 h-8 mb-2 opacity-20" />
                            <p className="text-[10px] font-bold text-muted-foreground/40 tracking-tight">All units deployed</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Right Column: Today's To-Do List */}
            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`rounded-xl border p-4 flex flex-col transition-all duration-300 shadow-sm relative overflow-hidden ${
                    dragOverTodo
                        ? 'border-[#1D3557] bg-indigo-50/50 dark:bg-indigo-950/20 border-dashed scale-[1.01] z-10'
                        : 'border-border bg-secondary/30 backdrop-blur-sm'
                }`}
            >
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
                    <div className="flex items-center gap-3">
                        <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/30">
                            <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <h3 className="font-bold text-sm tracking-tight text-foreground flex items-center gap-2">
                            {isToday(selectedDate) ? "Active Sync Protocol" : format(selectedDate, 'MMM d')}
                            <span className="text-[8px] bg-emerald-500 text-white px-1 rounded">V2</span>
                        </h3>
                        
                        <div className="flex items-center gap-1.5 ml-1">
                            {sortedTodos.length > 0 && (
                                <button
                                    type="button"
                                    onClick={handleCopyForDM}
                                    className="p-1.5 rounded-xl hover:bg-secondary text-muted-foreground/40 hover:text-foreground transition-all active:scale-90 border border-transparent hover:border-border"
                                    title="Copy to-do list for DM"
                                >
                                    {copied ? (
                                        <span className="text-[8px] text-emerald-500 font-black uppercase tracking-widest px-1">Copied</span>
                                    ) : (
                                        <Copy className="w-3.5 h-3.5" />
                                    )}
                                </button>
                            )}
                            {sortedTodos.length > 0 && (
                                <button
                                    type="button"
                                    onClick={handleSendToWebhook}
                                    disabled={sending}
                                    className={`p-1.5 rounded-xl transition-all active:scale-90 border ${
                                        sending
                                            ? 'bg-secondary text-indigo-400 cursor-not-allowed border-border'
                                            : sendResult
                                                ? sendResult.success
                                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400 dark:border-emerald-800'
                                                    : 'bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400 dark:border-rose-800'
                                                : 'bg-indigo-600 hover:bg-indigo-700 text-white border-[#1D3557] shadow-lg shadow-indigo-600/20'
                                    }`}
                                    title="Send to-do list to Lark"
                                >
                                    {sending ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : sendResult ? (
                                        <span className={`text-[8px] font-black uppercase tracking-widest px-1`}>
                                            {sendResult.message}
                                        </span>
                                    ) : (
                                        <Send className="w-3.5 h-3.5" />
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        {dailyTodos.saving && (
                            <div className="flex items-center gap-1.5 text-[9px] font-bold text-muted-foreground/60 tracking-tight">
                                <div className="w-1.5 h-1.5 rounded-full bg-[#1D3557]" />
                                Synced
                            </div>
                        )}
                        <Badge variant="outline" className="text-[10px] font-bold tracking-tight border-[#1D3557] text-indigo-700 bg-indigo-50 dark:border-indigo-800/50 dark:text-indigo-300 dark:bg-transparent shadow-sm">
                            {sortedTodos.length} Objectives
                        </Badge>
                    </div>
                </div>

                {dragOverTodo && (
                    <div className="flex items-center justify-center py-4 mb-3 rounded-xl border-2 border-dashed border-[#1D3557]/50 bg-indigo-50/50 dark:bg-indigo-950/30 animate-in fade-in zoom-in-95 duration-300 shadow-inner">
                        <Plus className="w-4 h-4 text-indigo-600 dark:text-indigo-400 mr-2 animate-bounce" />
                        <span className="text-indigo-700 dark:text-indigo-300 text-xs font-bold tracking-tight">Deploy to Active Path</span>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1.5">
                    {sortedTodos.map((todoItem) => {
                        const task = analyses[todoItem.taskId];
                        if (!task) return null;
                        const notes = meetingNotes[task.taskId] || [];
                        const latestNote = getLatestMeetingNote(notes);
                        const isBlockedByOthers =
                            latestNote?.isStall && latestNote.blockedBy && latestNote.blockedBy !== personData.person;
                        const blockedByLabel =
                            isBlockedByOthers && latestNote?.blockedBy
                                ? latestNote.blockedBy
                                : isBlockedByOthers && task.blockedBy && task.blockedBy !== personData.person
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
                                onRemoveFromTodo={() => dailyTodos.removeTodo(personData.person, dateStr, todoItem.taskId)}
                                onToggleComplete={() => dailyTodos.toggleTodoComplete(personData.person, dateStr, todoItem.taskId)}
                                blockedByLabel={blockedByLabel}
                                 actions={null}
                            />
                        );
                    })}

                    {sortedTodos.length === 0 && !dragOverTodo && (
                        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/30 bg-secondary/10 rounded-xl border border-dashed border-border/50">
                            <Calendar className="w-10 h-10 mb-3 opacity-10" />
                            <p className="text-xs font-bold text-muted-foreground/30 tracking-tight">No active objectives</p>
                            <p className="text-[10px] mt-2 font-medium text-muted-foreground/40">Drag tasks from backlog to initiate protocol</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
