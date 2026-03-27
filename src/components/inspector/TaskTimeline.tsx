'use client';

import React, { useMemo, useState } from 'react';
import { TaskAnalysis, StatusHistoryEntry, MeetingNote } from '@/lib/types';
import { isBottleneckStatus, getStatusSeverity } from '@/lib/workflow-engine';
import { Badge } from '../ui/badge';
import { format } from 'date-fns';
import {
    ArrowDown,
    Calendar,
    ChevronDown,
    ChevronUp,
    Clock,
    Edit2,
    MessageSquare,
    Moon,
    OctagonAlert,
    Shield,
    Trash2,
    User,
    Zap,
    MoveRight,
    ChevronDown as ChevronDownIcon
} from 'lucide-react';
import { calculateWorkingDuration, formatWorkingTime, formatAbsoluteTime } from '@/lib/date-utils';
import { useSprintConfig } from '@/lib/hooks/useSprintConfig';

// ── Duration Formatters ────────────────────────────────────────────

function getDurationColor(ms: number, isOvertime: boolean): string {
    const hours = ms / (1000 * 60 * 60);
    if (!isOvertime) {
        if (hours >= 15) return 'text-red-600 dark:text-red-400'; // >= 2 days
        if (hours >= 7.5) return 'text-amber-600 dark:text-amber-400'; // >= 1 day
        if (hours >= 4) return 'text-yellow-600 dark:text-yellow-300';
    } else {
        if (hours >= 12) return 'text-indigo-600 dark:text-indigo-400';
        if (hours >= 4) return 'text-fuchsia-600 dark:text-fuchsia-400';
    }
    return 'text-muted-foreground';
}

// ── Color mapping for status dot ──────────────────────────────────

function getStatusDotColor(status: string): string {
    const severity = getStatusSeverity(status);
    if (severity === 'critical') return 'bg-red-500 shadow-red-500/20';
    if (severity === 'high') return 'bg-amber-500 shadow-amber-500/20';
    if (status === 'Completed' || status === 'Staging Passed') return 'bg-emerald-500 shadow-emerald-500/20';
    if (status === 'In Process' || status === 'Testing' || status === 'Bug Fixing') return 'bg-indigo-500 shadow-indigo-500/20';
    return 'bg-muted-foreground/40';
}

function getStatusLineColor(status: string): string {
    const severity = getStatusSeverity(status);
    if (severity === 'critical') return 'border-red-500/30';
    if (severity === 'high') return 'border-amber-500/30';
    return 'border-border/40';
}

// ── Color mapping for status backgrounds (Timeline Bar) ─────────

function getStatusBgColor(status: string, isOvertime: boolean): string {
    if (isOvertime) return 'bg-indigo-600';
    const lower = status.toLowerCase();

    if (lower.includes('completed') || lower.includes('passed')) return 'bg-emerald-500';
    if (lower.includes('testing') || lower.includes('qa')) return 'bg-cyan-500';
    if (lower.includes('ready for test')) return 'bg-teal-500';
    if (lower.includes('in process') || lower.includes('dev')) return 'bg-indigo-500';
    if (lower.includes('bug') || lower.includes('fail') || lower.includes('reprocess')) return 'bg-rose-500';

    // Fallback severity check
    if (lower.includes('block') || lower.includes('critical')) return 'bg-red-500';
    if (lower.includes('high')) return 'bg-amber-500';

    return 'bg-slate-500';
}

interface TaskTimelineProps {
    taskAnalysis: TaskAnalysis;
    meetingNotes: MeetingNote[];
    onEditNote: (note: MeetingNote) => void;
    onDeleteNote: (id: string) => void;
}

export function TaskTimeline({
    taskAnalysis,
    meetingNotes,
    onEditNote,
    onDeleteNote,
}: TaskTimelineProps) {
    const [expanded, setExpanded] = useState(true);
    const [viewMode, setViewMode] = useState<'status' | 'day'>('day');
    const [hoveredId, setHoveredId] = useState<string | null>(null);

    const { getCurrentSprint } = useSprintConfig();
    const activeSprint = getCurrentSprint();

    // Build unified timeline events grouped by date
    const groupedEvents = useMemo(() => {
        const history = taskAnalysis.statusHistory;
        const statusEvents: TimelineEvent[] = history.map((entry, i) => {
            const isLast = i === history.length - 1;
            let endMs = 0;

            if (isLast) {
                const isCompleted = entry.status === 'Completed' || entry.status === 'Staging Passed';
                endMs = isCompleted ? new Date(entry.timestamp).getTime() : Date.now();
            } else {
                endMs = new Date(history[i + 1].timestamp).getTime();
            }

            const startMs = new Date(entry.timestamp).getTime();
            const { workingMs, offHoursMs } = calculateWorkingDuration(
                startMs,
                endMs,
                activeSprint?.startDate,
                activeSprint?.endDate
            );

            const isOvertime = workingMs === 0 && offHoursMs > 0;
            const visualMs = isOvertime ? offHoursMs : workingMs;

            return {
                kind: 'status' as const,
                entry,
                durationMs: endMs - startMs,
                workingMs,
                offHoursMs,
                isOvertime,
                visualMs,
                isLast,
                index: i
            };
        });

        const noteEvents: TimelineEvent[] = meetingNotes.map((note) => ({
            kind: 'note' as const,
            note,
        }));

        // Merge and sort from latest to oldest (descending)
        const all = [...statusEvents, ...noteEvents].sort((a, b) => {
            const tsA = a.kind === 'status' ? new Date(a.entry.timestamp).getTime() : new Date(a.note.createdAt).getTime();
            const tsB = b.kind === 'status' ? new Date(b.entry.timestamp).getTime() : new Date(b.note.createdAt).getTime();
            return tsB - tsA;
        });

        // Group by local date string (e.g. "2023-10-23")
        const groups: Record<string, TimelineEvent[]> = {};
        all.forEach((evt) => {
            const dateObj =
                evt.kind === 'status' ? new Date(evt.entry.timestamp) : new Date(evt.note.createdAt);
            const dateStr = format(dateObj, 'yyyy-MM-dd');
            if (!groups[dateStr]) groups[dateStr] = [];
            groups[dateStr].push(evt);
        });

        // Convert to array sorted by date descending (latest groups on top)
        const sortedDates = Object.keys(groups).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
        return sortedDates.map((dateStr) => ({
            date: dateStr,
            events: groups[dateStr],
        }));
    }, [taskAnalysis, meetingNotes]);

    // Compute individual timeline segments for the summary bar and chips
    const timelineSegments = useMemo(() => {
        return taskAnalysis.statusHistory.map((entry, i) => {
            const isLast = i === taskAnalysis.statusHistory.length - 1;
            let endMs = 0;
            if (isLast) {
                const isCompleted = entry.status === 'Completed' || entry.status === 'Staging Passed';
                endMs = isCompleted ? new Date(entry.timestamp).getTime() : Date.now();
            } else {
                endMs = new Date(taskAnalysis.statusHistory[i + 1].timestamp).getTime();
            }
            const startMs = new Date(entry.timestamp).getTime();
            const { workingMs, offHoursMs } = calculateWorkingDuration(
                startMs,
                endMs,
                activeSprint?.startDate,
                activeSprint?.endDate
            );

            const isOvertime = workingMs === 0 && offHoursMs > 0;
            const visualMs = isOvertime ? offHoursMs : workingMs;

            return {
                id: `seg-${i}`,
                status: entry.status,
                startMs,
                endMs,
                dur: endMs - startMs,
                workingMs,
                offHoursMs,
                isOvertime,
                visualMs,
                dateStr: format(new Date(entry.timestamp), 'MMM d'),
            };
        });
    }, [taskAnalysis, activeSprint]);

    const totalVisualMs = useMemo(() => {
        return timelineSegments.reduce((sum, seg) => sum + seg.visualMs, 0);
    }, [timelineSegments]);

    const sprintDays = useMemo(() => {
        if (!activeSprint?.startDate || !activeSprint?.endDate) return [];
        const startObj = parseLocalDateLocal(activeSprint.startDate);
        const endObj = parseLocalDateLocal(activeSprint.endDate);
        if (!startObj || !endObj) return [];

        const days = [];
        const current = new Date(startObj.getFullYear(), startObj.getMonth(), startObj.getDate());
        const end = new Date(endObj.getFullYear(), endObj.getMonth(), endObj.getDate());

        while (current <= end) {
            days.push(new Date(current));
            current.setDate(current.getDate() + 1);
        }
        return days;
    }, [activeSprint]);

    // Aggregate segments for 'By Day' view
    const dailySegments = useMemo(() => {
        return sprintDays.map(dayObj => {
            const dateStr = format(dayObj, 'MMM d');
            const dayStartTs = dayObj.getTime();
            const dayEndTs = dayStartTs + 86400000 - 1; // 24 hours

            let dailyWorkingMs = 0;
            let dailyOffHoursMs = 0;
            const statuses = new Set<string>();

            timelineSegments.forEach(seg => {
                const overlapStart = Math.max(seg.startMs, dayStartTs);
                const overlapEnd = Math.min(seg.endMs, dayEndTs);
                if (overlapStart < overlapEnd) {
                    statuses.add(seg.status);
                    const dayDateStr = format(dayObj, 'yyyy-MM-dd');
                    const { workingMs, offHoursMs } = calculateWorkingDuration(
                        overlapStart,
                        overlapEnd,
                        dayDateStr,
                        dayDateStr
                    );
                    dailyWorkingMs += workingMs;
                    dailyOffHoursMs += offHoursMs;
                }
            });

            const isOvertime = dailyWorkingMs === 0 && dailyOffHoursMs > 0;
            const visualMs = isOvertime ? dailyOffHoursMs : dailyWorkingMs;

            return {
                dateStr,
                workingMs: dailyWorkingMs,
                offHoursMs: dailyOffHoursMs,
                visualMs,
                statuses
            };
        }).filter(d => d.workingMs > 0 || d.offHoursMs > 0);
    }, [timelineSegments, sprintDays]);

    const todayDateStr = format(new Date(), 'MMM d');

    return (
        <div className="space-y-6">
            {/* ── Section Header ── */}
            <div className="flex items-center justify-between w-full">
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="flex items-center gap-2.5 group active:scale-95 transition-transform"
                >
                    <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/20">
                        <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <h3 className="text-[10px] font-black tracking-widest text-foreground uppercase">
                        Timeline Overview
                    </h3>
                    <div className="text-muted-foreground/30 group-hover:text-foreground transition-colors">
                        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                </button>

                {expanded && (
                    <div className="flex bg-secondary/50 border border-border/50 rounded-xl p-1 shadow-sm">
                        <button
                            onClick={(e) => { e.stopPropagation(); setViewMode('status'); }}
                            className={`text-[9px] uppercase font-black px-3 py-1.5 rounded-lg transition-all tracking-widest ${viewMode === 'status' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100 dark:shadow-indigo-950/30' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Sequence
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); setViewMode('day'); }}
                            className={`text-[9px] uppercase font-black px-3 py-1.5 rounded-lg transition-all tracking-widest ${viewMode === 'day' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100 dark:shadow-indigo-950/30' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Daily
                        </button>
                    </div>
                )}
            </div>

            {expanded && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-500">
                    {/* ── Duration Summary Bar ── */}
                    {totalVisualMs > 0 && (
                        <div className="space-y-4 pb-4">
                            {/* Stacked bar or Daily grid */}
                            {viewMode === 'status' ? (
                                <div className="flex h-4 rounded-full overflow-hidden bg-secondary border border-border shadow-inner p-0.5">
                                    {timelineSegments.map((seg, i) => {
                                        const { id, status, visualMs, workingMs, isOvertime, dateStr } = seg;
                                        const pct = (visualMs / Math.max(1, totalVisualMs)) * 100;
                                        if (pct < 0.2) return null;

                                        const bgColor = getStatusBgColor(status, isOvertime);

                                        const isHovered = hoveredId === id;
                                        const isDimmed = hoveredId !== null && !isHovered;

                                        const isNewDate = i === 0 || timelineSegments[i - 1].dateStr !== dateStr;

                                        // For segments longer than a workday, we draw internal markers
                                        const WORKDAY_MS = 27000000; // 7.5 hours
                                        const internalNotches = [];
                                        if (!isOvertime && visualMs > WORKDAY_MS) {
                                            const count = Math.floor(visualMs / WORKDAY_MS);
                                            for (let k = 1; k <= count; k++) {
                                                const pctPos = ((k * WORKDAY_MS) / visualMs) * 100;
                                                if (pctPos < 99) { // Don't draw exactly at the very end
                                                    internalNotches.push({ pctPos, dayCount: k });
                                                }
                                            }
                                        }

                                        return (
                                            <div
                                                key={id}
                                                onMouseEnter={() => setHoveredId(id)}
                                                onMouseLeave={() => setHoveredId(null)}
                                                className={`${bgColor} ${isDimmed ? 'opacity-25 grayscale-[0.5]' : 'opacity-100'} transition-all duration-300 relative group/bar cursor-pointer hover:brightness-110 hover:z-20 rounded-sm mx-[0.5px]`}
                                                style={{ width: `${pct}%`, minWidth: pct > 1.5 ? undefined : '3px' }}
                                                title={`${status} (${dateStr}): ${isOvertime ? formatAbsoluteTime(visualMs) + ' Overtime' : formatWorkingTime(workingMs)}`}
                                            >
                                                {internalNotches.map((notch, j) => (
                                                    <div
                                                        key={`notch-${j}`}
                                                        className="absolute top-0 bottom-0 w-[1px] bg-white/30 z-10"
                                                        style={{ left: `${notch.pctPos}%` }}
                                                    />
                                                ))}
                                                {isOvertime && (
                                                    <div className="absolute inset-0 opacity-20 bg-[repeating-linear-gradient(45deg,transparent,transparent_2px,white_2px,white_4px)] pointer-events-none" />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="flex h-16 rounded-2xl border border-border bg-secondary/20 relative isolate overflow-hidden group/grid shadow-inner p-1 gap-1">
                                    {sprintDays.map((dayObj, dayIdx) => {
                                        const dayStartTs = dayObj.getTime();
                                        const windowStart = dayStartTs + 8.5 * 3600 * 1000;
                                        const windowEnd = dayStartTs + 17.5 * 3600 * 1000;
                                        const windowDur = windowEnd - windowStart;

                                        const formattedDay = format(dayObj, 'MMM d');
                                        const isHoveredDay = hoveredId === formattedDay;
                                        const isDimmedDay = hoveredId !== null && !isHoveredDay;

                                        const todayTs = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime();
                                        const isToday = dayStartTs === todayTs;

                                        return (
                                            <div
                                                key={dayIdx}
                                                className={`relative flex-1 group/daycol rounded-xl transition-all cursor-pointer ${isHoveredDay ? 'bg-indigo-600/10 ring-1 ring-indigo-500/20 z-10' : isToday ? 'bg-indigo-50 dark:bg-indigo-950/20' : 'hover:bg-muted/50'}`}
                                                onMouseEnter={() => setHoveredId(formattedDay)}
                                                onMouseLeave={() => setHoveredId(null)}
                                                title={`${format(dayObj, 'EEEE, MMM d')}\nWorking Window: 8:30 - 17:30`}
                                            >
                                                {/* Dot Indicator for active days */}
                                                <div className="absolute top-1.5 left-1/2 -translate-x-1/2">
                                                    <div className={`w-1 h-1 rounded-full ${isHoveredDay ? 'bg-indigo-500 animate-pulse' : isToday ? 'bg-indigo-400' : 'bg-muted-foreground/10'}`} />
                                                </div>

                                                <div className={`absolute top-4 bottom-5 left-1.5 right-1.5 flex pointer-events-none transition-all duration-300 ${isDimmedDay ? 'opacity-20 grayscale' : 'opacity-100'}`}>
                                                    {timelineSegments.map(seg => {
                                                        const overlapStart = Math.max(seg.startMs, windowStart);
                                                        const overlapEnd = Math.min(seg.endMs, windowEnd);

                                                        if (overlapStart < overlapEnd) {
                                                            const leftPct = ((overlapStart - windowStart) / windowDur) * 100;
                                                            const widthPct = ((overlapEnd - overlapStart) / windowDur) * 100;
                                                            const bgColor = getStatusBgColor(seg.status, seg.isOvertime);

                                                            return (
                                                                <div
                                                                    key={`span-${seg.id}-${dayIdx}`}
                                                                    className={`absolute inset-y-0.5 rounded-[2px] shadow-sm ${bgColor} ${isHoveredDay ? 'ring-1 ring-white/50 z-10' : ''}`}
                                                                    style={{ left: `${leftPct}%`, width: `${widthPct}%`, minWidth: '2px' }}
                                                                />
                                                            );
                                                        }
                                                        return null;
                                                    })}
                                                </div>

                                                {/* Date Label */}
                                                <div className="absolute inset-x-0 bottom-0 py-1.5 flex items-center justify-center">
                                                    <span className={`text-[8px] font-black tracking-tighter uppercase transition-colors ${isHoveredDay ? 'text-indigo-600 dark:text-indigo-400' : isToday ? 'text-indigo-500' : 'text-muted-foreground/50'}`}>
                                                        {format(dayObj, 'd')}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Legend Chips Scrollable Container */}
                            <div className="flex flex-wrap gap-2 pt-1 border-t border-border/40">
                                {viewMode === 'status' ? (
                                    timelineSegments
                                        .filter(({ visualMs }) => (visualMs / Math.max(1, totalVisualMs)) * 100 >= 0.5)
                                        .map(({ id, status, workingMs, offHoursMs, visualMs, isOvertime, dateStr }) => {
                                            const isHovered = hoveredId === id;
                                            const isDimmed = hoveredId !== null && !isHovered;

                                            return (
                                                <button
                                                    key={id}
                                                    onMouseEnter={() => setHoveredId(id)}
                                                    onMouseLeave={() => setHoveredId(null)}
                                                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all duration-300 active:scale-95 ${isHovered
                                                        ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-950/30 dark:border-indigo-800 shadow-sm scale-[1.02] z-10'
                                                        : isDimmed
                                                            ? 'bg-secondary/30 border-transparent opacity-30 grayscale-[0.8]'
                                                            : 'bg-secondary border-border/50'
                                                        }`}
                                                >
                                                    <div className={`w-2 h-2 rounded-full ${isOvertime ? 'bg-indigo-500' : getStatusDotColor(status)} shadow-sm shadow-black/5 dark:shadow-white/5`} />
                                                    <div className="flex flex-col items-start leading-none">
                                                        <span className={`text-[9px] font-black uppercase tracking-tight ${isDimmed ? 'text-muted-foreground' : 'text-foreground'}`}>
                                                            {status}
                                                        </span>
                                                        <span className="text-[8px] font-bold text-muted-foreground/50">{dateStr}</span>
                                                    </div>
                                                    <div className={`font-mono text-[10px] font-black ml-1 ${isDimmed ? 'text-muted-foreground/30' : getDurationColor(visualMs, isOvertime)}`}>
                                                        {isOvertime ? formatAbsoluteTime(visualMs) : formatWorkingTime(workingMs)}
                                                    </div>
                                                </button>
                                            );
                                        })
                                ) : (
                                    dailySegments
                                        .map(({ dateStr, workingMs, offHoursMs, visualMs, statuses }) => {
                                            const isHovered = hoveredId === dateStr;
                                            const isDimmed = hoveredId !== null && !isHovered;
                                            const isOvertime = workingMs === 0 && offHoursMs > 0;
                                            const isToday = dateStr === todayDateStr;

                                            return (
                                                <button
                                                    key={dateStr}
                                                    onMouseEnter={() => setHoveredId(dateStr)}
                                                    onMouseLeave={() => setHoveredId(null)}
                                                    className={`inline-flex items-center gap-2.5 px-3 py-1.5 rounded-xl border transition-all duration-300 active:scale-95 ${isHovered || isToday
                                                        ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-950/30 dark:border-indigo-800 shadow-sm'
                                                        : isDimmed
                                                            ? 'bg-secondary/30 border-transparent opacity-30 grayscale'
                                                            : 'bg-secondary border-border/50'
                                                        }`}
                                                >
                                                    <Calendar className={`w-3 h-3 ${isHovered || isToday ? 'text-indigo-600 dark:text-indigo-400' : 'text-muted-foreground/30'}`} />
                                                    <span className={`text-[10px] font-black uppercase tracking-widest ${isDimmed ? 'text-muted-foreground/30' : 'text-foreground/80'}`}>{dateStr}</span>
                                                    <span className={`font-mono text-[11px] font-black ml-0.5 ${isDimmed ? 'text-muted-foreground/20' : getDurationColor(visualMs, isOvertime)}`}>
                                                        {isOvertime ? formatAbsoluteTime(visualMs) : formatWorkingTime(workingMs)}
                                                    </span>
                                                </button>
                                            );
                                        })
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── Vertical Timeline ── */}
                    <div className="space-y-6 max-h-[600px] overflow-y-auto pr-3 pb-4 custom-scrollbar">
                        {groupedEvents.map((group, groupIndex) => {
                            const [gy, gm, gd] = group.date.split('-');
                            const dayDate = new Date(Number(gy), Number(gm) - 1, Number(gd));
                            const isToday = group.date === format(new Date(), 'yyyy-MM-dd');

                            return (
                                <div
                                    key={`day-${group.date}`}
                                    className="relative flex flex-col pt-4 px-2 rounded-2xl transition-all duration-300 group/day"
                                >
                                    {/* ── Day Header ── */}
                                    <div className="flex items-center gap-4 mb-5">
                                        <div className={`flex items-center gap-2.5 text-[10px] font-black uppercase tracking-[0.2em] px-4 py-1.5 rounded-full border shadow-sm ${isToday ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-secondary text-muted-foreground border-border/50'}`}>
                                            <Calendar className={`w-3.5 h-3.5 ${isToday ? 'text-indigo-100' : 'opacity-40'}`} />
                                            {format(dayDate, 'EEE, MMM d')}
                                        </div>
                                        <div className="h-px bg-gradient-to-r from-border/50 to-transparent flex-1" />
                                    </div>

                                    {/* ── Day's Events ── */}
                                    <div className="relative ml-[22px] border-l-[3px] border-secondary/80 group-hover/day:border-indigo-500/10 transition-colors space-y-0">
                                        {group.events.map((evt, evtIndex) => {
                                            if (evt.kind === 'status') {
                                                const { entry, durationMs, workingMs, offHoursMs, isOvertime, visualMs, isLast, index } = evt;
                                                const bottleneck = isBottleneckStatus(entry.status);
                                                const dotColor = isOvertime ? 'bg-indigo-600' : getStatusDotColor(entry.status);

                                                const dateStrFragment = format(new Date(entry.timestamp), 'MMM d');
                                                const evtId = `seg-${index}`;
                                                const isHovered = viewMode === 'status' ? hoveredId === evtId : hoveredId === dateStrFragment;
                                                const isDimmed = hoveredId !== null && !isHovered;

                                                return (
                                                    <div
                                                        key={`s-${evt.index}`}
                                                        className={`relative pl-8 pb-8 group/item transition-all duration-300 ${isDimmed ? 'opacity-30 grayscale-[0.5]' : 'opacity-100'} ${isHovered ? 'translate-x-1' : ''}`}
                                                        onMouseEnter={() => setHoveredId(viewMode === 'status' ? evtId : dateStrFragment)}
                                                        onMouseLeave={() => setHoveredId(null)}
                                                    >
                                                        {/* Dot on the line */}
                                                        <div
                                                            className={`absolute left-[-8.5px] top-1.5 w-4 h-4 rounded-full border-[3px] border-card transition-all duration-300 ring-4 ring-transparent ${dotColor} ${isHovered ? 'scale-125 ring-indigo-500/10' : ''} z-10`}
                                                        />

                                                        <div className={`flex items-start justify-between gap-4 rounded-2xl p-4 -ml-2 -mt-2 transition-all duration-300 border ${isHovered ? 'bg-indigo-50 dark:bg-indigo-950/20 border-indigo-200/50 dark:border-indigo-800/50 shadow-md' : 'bg-secondary/40 border-transparent hover:bg-secondary/60 hover:border-border/30'}`}>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-3 flex-wrap mb-3">
                                                                    <span
                                                                        className={`text-sm font-black uppercase tracking-tight transition-colors ${bottleneck
                                                                            ? 'text-amber-600 dark:text-amber-400'
                                                                            : entry.status === 'Completed' || entry.status === 'Staging Passed'
                                                                                ? 'text-emerald-600 dark:text-emerald-400'
                                                                                : 'text-foreground'
                                                                            }`}
                                                                    >
                                                                        {entry.status}
                                                                    </span>
                                                                    {bottleneck && (
                                                                        <Badge className="gap-1.5 text-[8px] px-2 py-0.5 bg-amber-600 text-white border-none font-black shadow-sm uppercase tracking-widest">
                                                                            <Zap className="w-2.5 h-2.5" />
                                                                            BOTTLENECK
                                                                        </Badge>
                                                                    )}
                                                                </div>

                                                                <div className="flex items-center gap-4 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                                                                    <div className="flex items-center gap-1.5 bg-background/50 px-2 py-1 rounded-lg border border-border/30">
                                                                        <Clock className="w-3 h-3 opacity-40 text-indigo-500" />
                                                                        {format(new Date(entry.timestamp), 'HH:mm')}
                                                                    </div>
                                                                    {entry.person && (
                                                                        <div className="flex items-center gap-1.5 bg-background/50 px-2 py-1 rounded-lg border border-border/30 max-w-[150px] truncate">
                                                                            <User className="w-3 h-3 opacity-40 text-indigo-500" />
                                                                            <span className="truncate">{entry.person}</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Duration display */}
                                                            {durationMs > 0 && (
                                                                <div
                                                                    className={`flex flex-col items-end gap-1 px-4 py-2.5 rounded-2xl border transition-all duration-300 ${isOvertime
                                                                        ? 'bg-indigo-100/50 border-indigo-200 dark:bg-indigo-900/40 dark:border-indigo-800'
                                                                        : durationMs > 24 * 60 * 60 * 1000
                                                                            ? 'bg-amber-50 border-amber-100 dark:bg-amber-950/40 dark:border-amber-900'
                                                                            : 'bg-background border-border/50 shadow-sm'
                                                                        }`}
                                                                >
                                                                    <div className="flex flex-col items-end leading-none">
                                                                        <div className="flex items-center gap-2 text-[12px] font-black font-mono">
                                                                            {isOvertime ? <Moon className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" /> : <Clock className="w-3.5 h-3.5 text-muted-foreground/30" />}
                                                                            <span className={isOvertime ? 'text-indigo-700 dark:text-indigo-300' : getDurationColor(visualMs, false)}>
                                                                                {isOvertime ? formatAbsoluteTime(visualMs) : formatWorkingTime(workingMs)}
                                                                            </span>
                                                                        </div>
                                                                        {isOvertime && (
                                                                            <span className="text-[8px] font-black text-indigo-600/60 uppercase tracking-widest mt-1">Overtime</span>
                                                                        )}
                                                                        {isLast && (
                                                                            <span className="text-[9px] text-muted-foreground/40 font-black uppercase tracking-widest mt-1.5 flex items-center gap-1">
                                                                                <span className="w-1 h-1 rounded-full bg-indigo-500 animate-pulse" />
                                                                                Current
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            }

                                            // ── Meeting Note Event ──
                                            const { note } = evt;
                                            return (
                                                <div key={`n-${note.id}`} className="relative pl-8 pb-10 mt-2">
                                                    {/* Diamond marker on the line */}
                                                    <div className={`absolute left-[-7.5px] top-2 w-3.5 h-3.5 rotate-45 border-[3px] border-card z-10 shadow-sm transition-all duration-300 ${note.isStall ? 'bg-red-500' : 'bg-indigo-500'}`} />

                                                    <div
                                                        className={`rounded-2xl border p-5 transition-all duration-300 shadow-xl overflow-hidden relative group/note ${note.isStall
                                                            ? 'border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20'
                                                            : 'border-indigo-100 bg-indigo-50/50 dark:border-indigo-900/30 dark:bg-indigo-950/10'
                                                            }`}
                                                    >
                                                        {/* Header background accent */}
                                                        <div className={`absolute top-0 left-0 right-0 h-1 ${note.isStall ? 'bg-red-500' : 'bg-indigo-500'} opacity-20`} />

                                                        <div className="flex items-center justify-between mb-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`p-2 rounded-xl ${note.isStall ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400'}`}>
                                                                    <MessageSquare className="w-4 h-4" />
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <span className="text-[10px] font-black tracking-[0.15em] uppercase text-foreground/70">
                                                                        Daily Meeting Note
                                                                    </span>
                                                                    <span className="text-[10px] text-muted-foreground/50 font-black font-mono mt-0.5">
                                                                        {format(new Date(note.createdAt), 'HH:mm')}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                {note.isStall && (
                                                                    <Badge variant="destructive" className="text-[8px] px-2 py-0.5 gap-1.5 font-black uppercase tracking-widest border border-red-200 dark:border-red-900 shadow-sm">
                                                                        <OctagonAlert className="w-2.5 h-2.5" />
                                                                        STALLED
                                                                    </Badge>
                                                                )}
                                                                <button
                                                                    onClick={() => onEditNote(note)}
                                                                    className="p-2 rounded-xl text-muted-foreground/30 hover:text-indigo-600 hover:bg-white dark:hover:bg-indigo-950/50 transition-all active:scale-90"
                                                                >
                                                                    <Edit2 className="w-3.5 h-3.5" />
                                                                </button>
                                                                <button
                                                                    onClick={() => onDeleteNote(note.id)}
                                                                    className="p-2 rounded-xl text-muted-foreground/30 hover:text-red-500 hover:bg-white dark:hover:bg-red-950/50 transition-all active:scale-90"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        </div>

                                                        <div className="space-y-3">
                                                            {/* Stall reason */}
                                                            {note.isStall && note.stallReason && (
                                                                <div className="p-3 bg-white/50 dark:bg-black/20 rounded-xl border border-red-100 dark:border-red-950/50 animate-in fade-in zoom-in-95">
                                                                    <div className="text-[9px] font-black text-red-600 uppercase tracking-widest mb-1 opacity-60">Blocker Reason</div>
                                                                    <div className="text-xs text-foreground font-black leading-relaxed">
                                                                        {note.stallReason}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* Blocked by */}
                                                            {note.blockedBy && (
                                                                <div className="flex items-center gap-3 bg-amber-50 dark:bg-amber-950/20 px-4 py-2.5 rounded-xl border border-amber-100 dark:border-amber-900/30">
                                                                    <div className="bg-amber-100 dark:bg-amber-900/50 p-1.5 rounded-lg shadow-sm">
                                                                        <User className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                                                                    </div>
                                                                    <div className="flex flex-col">
                                                                        <span className="text-[9px] font-black text-amber-700/60 uppercase tracking-widest">Caused by</span>
                                                                        <span className="font-black text-xs text-amber-800 dark:text-amber-300">{note.blockedBy}</span>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* Solution */}
                                                            {note.solution && (
                                                                <div className="bg-emerald-50 dark:bg-emerald-950/10 px-4 py-3 rounded-xl border border-emerald-100 dark:border-emerald-900/20 flex gap-3 shadow-inner">
                                                                    <div className="bg-emerald-100 dark:bg-emerald-900/40 p-1.5 rounded-lg h-fit">
                                                                        <Shield className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                                                    </div>
                                                                    <div className="flex-1">
                                                                        <span className="block text-emerald-700 dark:text-emerald-600 font-black uppercase tracking-widest text-[9px] mb-1.5">Mitigation Plan</span>
                                                                        <span className="text-xs text-foreground/80 font-bold leading-relaxed">{note.solution}</span>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

// ── UTILITIES ────────────────────────────────────────────────────────

function parseLocalDateLocal(dateStr: string): Date | null {
    if (!dateStr) return null;
    const parts = dateStr.split('-');
    if (parts.length !== 3) return null;
    const [y, m, d] = parts;
    return new Date(Number(y), Number(m) - 1, Number(d));
}

type TimelineEvent =
    | { kind: 'status'; entry: StatusHistoryEntry; durationMs: number; workingMs: number; offHoursMs: number; isOvertime: boolean; visualMs: number; isLast: boolean; index: number }
    | { kind: 'note'; note: MeetingNote };
