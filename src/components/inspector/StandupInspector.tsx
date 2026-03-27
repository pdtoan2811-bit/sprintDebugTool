'use client';

import React, { useState, useEffect } from 'react';
import { TimelineSegment, TaskAnalysis, MeetingNote } from '@/lib/types';
import { isBottleneckStatus, getStatusSeverity } from '@/lib/workflow-engine';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '../ui/sheet';
import { TaskTimeline } from './TaskTimeline';
import { Badge } from '../ui/badge';
import { format } from 'date-fns';
import {
    AlertTriangle,
    Calendar,
    Check,
    ChevronDown,
    ChevronUp,
    Clock,
    ExternalLink,
    OctagonAlert,
    Pin,
    Plus,
    RefreshCw,
    ToggleLeft,
    ToggleRight,
    User,
    Users,
    Zap,
} from 'lucide-react';

import { useRoles, ROLE_ORDER } from '@/lib/hooks/useRoles';

interface EnhancedInspectorProps {
    segment: TimelineSegment | null;
    taskAnalysis: TaskAnalysis | null;
    onClose: () => void;
    // High risk
    isHighRisk: boolean;
    onToggleHighRisk: (taskId: string) => void;
    // Meeting notes
    meetingNotes: MeetingNote[];
    onAddMeetingNote: (note: MeetingNote) => void;
    onUpdateMeetingNote: (note: MeetingNote) => void;
    onDeleteMeetingNote: (id: string) => void;
    // All persons in the sprint for context
    allPersons: string[];
}

export function StandupInspector({
    segment,
    taskAnalysis,
    onClose,
    isHighRisk,
    onToggleHighRisk,
    meetingNotes,
    onAddMeetingNote,
    onUpdateMeetingNote,
    onDeleteMeetingNote,
    allPersons,
}: EnhancedInspectorProps) {
    // Meeting note form state
    const [showMeetingForm, setShowMeetingForm] = useState(false);
    const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
    const [meetingIsStall, setMeetingIsStall] = useState(true);
    const [meetingStallReason, setMeetingStallReason] = useState('');
    const [meetingBlockedBy, setMeetingBlockedBy] = useState('');
    const [meetingSolution, setMeetingSolution] = useState('');
    const [meetingIsMovedToNextSprint, setMeetingIsMovedToNextSprint] = useState(false);

    useEffect(() => {
        if (segment) {
            // Reset meeting form
            setShowMeetingForm(false);
            setEditingNoteId(null);
            setMeetingIsStall(true);
            setMeetingStallReason('');
            setMeetingBlockedBy('');
            setMeetingSolution('');
            setMeetingIsMovedToNextSprint(false);
        }
    }, [segment]);

    const { roles } = useRoles();

    // Build list of people for the "Blocked by" dropdown
    const assignedPeople = taskAnalysis
        ? [...new Set(taskAnalysis.statusHistory.map((h) => h.person || '').flatMap((p) => p.split(',').map((n) => n.trim())).filter(Boolean))]
        : [];

    const teamLeaders = allPersons.filter(p => roles[p] === 'Team Leader');
    const otherPeople = allPersons.filter(p => roles[p] !== 'Team Leader' && !assignedPeople.includes(p));

    const handleAddOrUpdateMeetingNote = () => {
        if (!segment) return;
        const note: MeetingNote = {
            id: editingNoteId || `${segment.taskId}_meeting_${Date.now()}`,
            taskId: segment.taskId,
            date: new Date().toISOString().split('T')[0],
            isStall: meetingIsStall,
            stallReason: meetingIsStall ? meetingStallReason : '',
            blockedBy: meetingIsStall ? meetingBlockedBy : '',
            solution: meetingSolution,
            isMovedToNextSprint: meetingIsMovedToNextSprint,
            createdAt: new Date().toISOString(),
        };

        if (editingNoteId) {
            onUpdateMeetingNote(note);
        } else {
            onAddMeetingNote(note);
        }

        // Reset form
        setEditingNoteId(null);
        setMeetingIsStall(true);
        setMeetingStallReason('');
        setMeetingBlockedBy('');
        setMeetingSolution('');
        setMeetingIsMovedToNextSprint(false);
        setShowMeetingForm(false);
    };

    const handleEditNote = (note: MeetingNote) => {
        setEditingNoteId(note.id);
        setMeetingIsStall(note.isStall || false);
        setMeetingStallReason(note.stallReason || '');
        setMeetingBlockedBy(note.blockedBy || '');
        setMeetingSolution(note.solution || '');
        setMeetingIsMovedToNextSprint(note.isMovedToNextSprint || false);
        setShowMeetingForm(true);
    };

    if (!segment) return null;

    const severity = getStatusSeverity(segment.status);
    const isBottleneck = isBottleneckStatus(segment.status);

    return (
        <Sheet open={!!segment} onOpenChange={(open) => !open && onClose()}>
            <SheetContent open={!!segment} onOpenChange={(open: boolean) => !open && onClose()} className="flex flex-col h-full overflow-y-auto sm:max-w-xl w-[90%] p-6 bg-card border-l border-border shadow-2xl">
                <SheetHeader className="mb-6">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className="font-mono text-muted-foreground font-black bg-secondary/50 border border-border/50 px-2 flex items-center h-6 rounded-md uppercase text-[10px] tracking-tight">
                            {segment.taskId}
                        </span>
                        <Badge variant={segment.isCompleted ? 'outline' : 'default'} className="font-black uppercase tracking-widest text-[9px] px-2 py-0.5 shadow-sm">
                            {segment.status}
                        </Badge>
                        {isBottleneck && (
                            <Badge className={`gap-1.5 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 shadow-sm ${severity === 'critical'
                                ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800 animate-pulse'
                                : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800 animate-pulse'
                                }`}>
                                <Zap className="w-2.5 h-2.5" />
                                BOTTLENECK
                            </Badge>
                        )}
                    </div>
                    <SheetTitle className="text-2xl font-black mt-2 leading-tight tracking-tight text-foreground">
                        {segment.taskName}
                    </SheetTitle>
                    <SheetDescription className="mt-2 flex items-center gap-2 text-xs font-bold text-muted-foreground/60 uppercase tracking-widest bg-secondary/30 w-fit px-3 py-1 rounded-full border border-border/40">
                        <Clock className="w-3 h-3 group-hover:animate-pulse" />
                        <span>{segment.startTime instanceof Date && !isNaN(segment.startTime.getTime()) ? format(segment.startTime, 'MMM dd, HH:mm') : 'Unknown Start'}</span>
                        <span className="opacity-30">&rarr;</span>
                        <span>{segment.endTime instanceof Date && !isNaN(segment.endTime.getTime()) ? format(segment.endTime, 'MMM dd, HH:mm') : 'Unknown End'}</span>
                    </SheetDescription>
                </SheetHeader>

                <div className="flex-1 space-y-6">

                    {/* ── All Assigned People ── */}
                    {assignedPeople.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="text-[10px] font-black tracking-widest text-muted-foreground uppercase flex items-center gap-2">
                                <Users className="w-3.5 h-3.5 opacity-50" />
                                Assigned People
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {assignedPeople.map((person) => (
                                    <span
                                        key={person}
                                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-secondary border border-border text-[10px] text-muted-foreground font-black uppercase tracking-tight shadow-sm"
                                    >
                                        <User className="w-3 h-3 text-muted-foreground/40" />
                                        {person}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Toggles Grid ── */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* High Risk Toggle */}
                        <button
                            onClick={() => onToggleHighRisk(segment.taskId)}
                            className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all active:scale-95 shadow-sm ${isHighRisk
                                ? 'border-red-500 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300'
                                : 'border-border bg-secondary/30 text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                                }`}
                        >
                            <div className="flex items-center gap-2">
                                <Pin className={`w-3.5 h-3.5 ${isHighRisk ? 'text-red-500 fill-red-500 animate-bounce' : ''}`} />
                                <span className="text-[10px] font-black uppercase tracking-widest">High Risk</span>
                            </div>
                            {isHighRisk ? (
                                <ToggleRight className="w-6 h-6 text-red-500" />
                            ) : (
                                <ToggleLeft className="w-6 h-6 text-muted-foreground/30" />
                            )}
                        </button>

                        {/* Move to Next Sprint Toggle */}
                        <button
                            onClick={() => setMeetingIsMovedToNextSprint(!meetingIsMovedToNextSprint)}
                            className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all active:scale-95 shadow-sm ${meetingIsMovedToNextSprint
                                ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300'
                                : 'border-border bg-secondary/30 text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                                }`}
                        >
                            <div className="flex items-center gap-2">
                                <RefreshCw className={`w-3.5 h-3.5 ${meetingIsMovedToNextSprint ? 'text-indigo-500 animate-spin' : ''}`} style={{ animationDuration: '4s' }} />
                                <span className="text-[10px] font-black uppercase tracking-widest italic">Move Next</span>
                            </div>
                            {meetingIsMovedToNextSprint ? (
                                <ToggleRight className="w-6 h-6 text-indigo-500" />
                            ) : (
                                <ToggleLeft className="w-6 h-6 text-muted-foreground/30" />
                            )}
                        </button>
                    </div>

                    {/* ── Doom Loop Indicator ── */}
                    {taskAnalysis && (taskAnalysis.doomLoopCount > 0 || taskAnalysis.reprocessCount > 1) && (
                        <div className={`px-4 py-3 rounded-xl border shadow-sm ${taskAnalysis.riskLevel === 'critical'
                            ? 'border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30'
                            : 'border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20'
                            }`}>
                            <div className="flex items-center gap-2 mb-2">
                                <RefreshCw className={`w-3.5 h-3.5 ${taskAnalysis.riskLevel === 'critical' ? 'text-red-600 animate-spin' : 'text-amber-600'
                                    }`} style={{ animationDuration: '3s' }} />
                                <span className="text-[10px] font-black text-foreground uppercase tracking-widest">
                                    Doom Loop Detected
                                </span>
                                <Badge variant="destructive" className="text-[9px] px-2 py-0.5 ml-auto font-black shadow-sm">
                                    {taskAnalysis.doomLoopCount} cycle(s)
                                </Badge>
                            </div>
                            <p className="text-[11px] text-muted-foreground font-medium">
                                Reprocessed {taskAnalysis.reprocessCount}&times; &mdash; Risk: <span className={
                                    taskAnalysis.riskLevel === 'critical' ? 'text-red-700 dark:text-red-400 font-black' : 'text-amber-700 dark:text-amber-400 font-black'
                                }>{taskAnalysis.riskLevel.toUpperCase()}</span>
                            </p>
                        </div>
                    )}

                    {/* ── Blocking Transitions (> 8 working hours) ── */}
                    {taskAnalysis && taskAnalysis.blockingTransitions && taskAnalysis.blockingTransitions.length > 0 && (
                        <div className="px-4 py-3 rounded-xl border border-orange-200 bg-orange-50 dark:border-orange-900/50 dark:bg-orange-950/20 shadow-sm">
                            <div className="flex items-center gap-2 mb-2.5">
                                <AlertTriangle className="w-3.5 h-3.5 text-orange-600" />
                                <span className="text-[10px] font-black text-foreground uppercase tracking-widest">
                                    Long Status Durations
                                </span>
                                <Badge className="text-[9px] px-2 py-0.5 ml-auto bg-orange-600 text-white font-black border-none shadow-sm">
                                    {taskAnalysis.blockingTransitions.length} blocking
                                </Badge>
                            </div>
                            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight mb-3 opacity-60">
                                Working hours &gt; 8h per transition
                            </p>
                            <div className="space-y-2">
                                {taskAnalysis.blockingTransitions.map((bt, idx) => (
                                    <div
                                        key={idx}
                                        className="flex items-center gap-3 px-3 py-2 bg-background/50 rounded-lg border border-orange-200/50 dark:border-orange-900/30 text-[11px] shadow-inner"
                                    >
                                        <Clock className="w-3.5 h-3.5 text-orange-600 flex-shrink-0" />
                                        <span className="text-muted-foreground font-black uppercase tracking-tight text-[10px]">{bt.fromStatus}</span>
                                        <span className="text-muted-foreground/30 font-bold">&rarr;</span>
                                        <span className="text-muted-foreground font-black uppercase tracking-tight text-[10px]">{bt.toStatus}</span>
                                        <span className="ml-auto text-orange-700 dark:text-orange-300 font-black font-mono">
                                            {bt.workingHoursElapsed}h
                                        </span>
                                        {bt.person && (
                                            <span className="text-muted-foreground/60 flex items-center gap-1.5 font-bold uppercase text-[9px]">
                                                <User className="w-3 h-3 opacity-40" />
                                                <span className="truncate max-w-[80px]">{bt.person}</span>
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Metadata Grid ── */}
                    <div className="grid grid-cols-2 gap-4 border border-border/50 rounded-2xl p-5 bg-secondary/20 shadow-inner">
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 opacity-60">Assignee</span>
                            <span className="font-mono text-xs text-foreground font-bold">{segment.person}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 opacity-60">Module</span>
                            <span className="font-mono text-xs text-foreground font-bold">{segment.module || '—'}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 opacity-60">Screen</span>
                            <span className="font-mono text-xs text-foreground font-bold">{segment.screen || '—'}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 opacity-60">Goal</span>
                            <span className="font-mono text-xs text-foreground font-bold break-words">{segment.sprintGoal || '—'}</span>
                        </div>
                        {(segment.recordLink || taskAnalysis?.recordLink) && (
                            <div className="flex flex-col col-span-2 pt-2 border-t border-border/20 mt-2">
                                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-2 opacity-60">External Record</span>
                                <a
                                    href={segment.recordLink || taskAnalysis?.recordLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 font-bold text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 hover:underline transition-colors w-fit bg-indigo-50 dark:bg-indigo-950/30 px-3 py-1.5 rounded-lg border border-indigo-100 dark:border-indigo-900/50 shadow-sm"
                                >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    <span className="truncate">Open in Source System</span>
                                </a>
                            </div>
                        )}
                    </div>

                    <div className="relative py-2">
                        <div className="absolute inset-0 flex items-center" aria-hidden="true">
                            <div className="w-full border-t border-border/50"></div>
                        </div>
                        <div className="relative flex justify-center">
                            <span className="px-3 bg-card text-[10px] font-black uppercase tracking-widest text-muted-foreground/30">Action & Timeline</span>
                        </div>
                    </div>

                    {/* ══════════════════════════════════════════════════════════════
                        ── MEETING NOTES FORM ──
                       ══════════════════════════════════════════════════════════════ */}

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-[10px] font-black tracking-widest text-foreground uppercase flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                Daily Meeting Notes
                            </h3>
                            <button
                                onClick={() => setShowMeetingForm(!showMeetingForm)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-sm ${showMeetingForm
                                    ? 'bg-secondary text-muted-foreground border border-border shadow-inner'
                                    : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-100 dark:shadow-indigo-950/30 border border-indigo-500/30'
                                    }`}
                            >
                                {showMeetingForm ? (
                                    <>
                                        <ChevronUp className="w-3.5 h-3.5" /> Cancel
                                    </>
                                ) : (
                                    <>
                                        <Plus className="w-3.5 h-3.5" /> New Note
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Meeting note form */}
                        {showMeetingForm && (
                            <div className="rounded-2xl border border-indigo-200/50 bg-indigo-50/30 dark:border-indigo-800/40 dark:bg-indigo-950/20 p-5 space-y-4 animate-in slide-in-from-top-4 duration-300 shadow-sm">
                                {/* Stall toggle */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        const newIsStall = !meetingIsStall;
                                        setMeetingIsStall(newIsStall);
                                        if (!newIsStall) {
                                            setMeetingBlockedBy('');
                                            setMeetingStallReason('');
                                        }
                                    }}
                                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all active:scale-[0.98] ${meetingIsStall
                                        ? 'border-red-500 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 shadow-sm shadow-red-100 dark:shadow-red-900/20'
                                        : 'border-border bg-background/50 text-muted-foreground'
                                        }`}
                                >
                                    <span className="flex items-center gap-2.5">
                                        <OctagonAlert className={`w-4 h-4 ${meetingIsStall ? 'animate-pulse' : 'opacity-40'}`} />
                                        Is this task stalled?
                                    </span>
                                    {meetingIsStall ? (
                                        <ToggleRight className="w-6 h-6 text-red-500" />
                                    ) : (
                                        <ToggleLeft className="w-6 h-6 text-muted-foreground/30" />
                                    )}
                                </button>

                                {/* Stall details - only shown when task is stalled */}
                                {meetingIsStall && (
                                    <div className="space-y-4 pl-4 border-l-2 border-red-500/30 animate-in slide-in-from-left-2">
                                        {/* Blocked by dropdown */}
                                        <div className="space-y-2">
                                            <label className="text-[9px] text-red-600 dark:text-red-400 font-black uppercase tracking-widest ml-1">Blocked By (Who?)</label>
                                            <div className="relative">
                                                <select
                                                    value={meetingBlockedBy}
                                                    onChange={(e) => setMeetingBlockedBy(e.target.value)}
                                                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-xs text-foreground font-bold focus:outline-none focus:ring-2 focus:ring-red-500/20 appearance-none shadow-sm transition-all"
                                                >
                                                    <option value="">Select Blocker...</option>
                                                    {assignedPeople.length > 0 && (
                                                        <optgroup label="ASSIGNED FOR THIS TASK">
                                                            {assignedPeople.map((p) => {
                                                                const roleLabel = roles[p] && roles[p] !== 'Other' ? ` (${roles[p]})` : '';
                                                                return <option key={`assigned-${p}`} value={p}>{p}{roleLabel}</option>;
                                                            })}
                                                        </optgroup>
                                                    )}
                                                    {teamLeaders.length > 0 && (
                                                        <optgroup label="TEAM LEADERS">
                                                            {teamLeaders.sort().map((p) => (
                                                                <option key={`leader-${p}`} value={p}>{p}</option>
                                                            ))}
                                                        </optgroup>
                                                    )}
                                                    {otherPeople.length > 0 && (
                                                        <optgroup label="EVERYONE ELSE">
                                                            {otherPeople.sort().map((p) => {
                                                                const roleLabel = roles[p] && roles[p] !== 'Other' ? ` (${roles[p]})` : '';
                                                                return <option key={`other-${p}`} value={p}>{p}{roleLabel}</option>;
                                                            })}
                                                        </optgroup>
                                                    )}
                                                </select>
                                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground opacity-50 pointer-events-none" />
                                            </div>
                                        </div>

                                        {/* Stall reason */}
                                        <div className="space-y-2">
                                            <label className="text-[9px] text-red-600 dark:text-red-400 font-black uppercase tracking-widest ml-1">Why is it stalled?</label>
                                            <textarea
                                                rows={2}
                                                value={meetingStallReason}
                                                onChange={(e) => setMeetingStallReason(e.target.value)}
                                                placeholder="Detail the blocker..."
                                                className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-xs text-foreground font-bold placeholder:text-muted-foreground/30 focus:outline-none focus:ring-2 focus:ring-red-500/20 resize-none shadow-sm transition-all"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Info message when not stalled */}
                                {!meetingIsStall && (
                                    <div className="px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-black uppercase tracking-tight flex items-center gap-2.5 shadow-sm">
                                        <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                                            <Check className="w-3 h-3" />
                                        </div>
                                        <span>Task is progressing normally.</span>
                                    </div>
                                )}

                                {/* Solution */}
                                <div className="space-y-2">
                                    <label className="text-[9px] text-muted-foreground font-black uppercase tracking-widest ml-1 opacity-60">Action Plan / Solution</label>
                                    <textarea
                                        rows={2}
                                        value={meetingSolution}
                                        onChange={(e) => setMeetingSolution(e.target.value)}
                                        placeholder="What's the mitigation plan?"
                                        className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-xs text-foreground font-bold placeholder:text-muted-foreground/30 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none shadow-sm transition-all"
                                    />
                                </div>

                                {/* Save button */}
                                <button
                                    onClick={handleAddOrUpdateMeetingNote}
                                    className="w-full bg-indigo-600 text-white font-black uppercase tracking-widest p-3 rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 dark:shadow-indigo-950/40 text-[11px] active:scale-[0.98] border border-indigo-500/30"
                                >
                                    {editingNoteId ? 'Update Meeting Note' : 'Save Meeting Note'}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* ── Unified Timeline (Status History + Meeting Notes) ── */}
                    {taskAnalysis && (
                        <div className="mt-4 animate-in fade-in duration-500">
                            <TaskTimeline
                                taskAnalysis={taskAnalysis}
                                meetingNotes={meetingNotes}
                                onEditNote={handleEditNote}
                                onDeleteNote={onDeleteMeetingNote}
                            />
                        </div>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
