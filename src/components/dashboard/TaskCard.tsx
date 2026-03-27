import React, { DragEvent, useState } from 'react';
import { TaskAnalysis } from '@/lib/types';
import { hasMetSprintGoal } from '@/lib/utils';
import { 
    Check, 
    CheckCircle2, 
    ChevronRight, 
    Clock, 
    GripVertical, 
    Target, 
    Trash2, 
    Users,
    Layers,
    Monitor,
    Layout
} from 'lucide-react';
import { priorityDotColor, StatusBadge, formatStaleHours } from '@/lib/status-utils';

export interface TaskCardProps {
    task: TaskAnalysis;
    isHighRisk?: boolean;
    onTaskClick: (taskId: string) => void;
    
    // Interactions
    isDraggable?: boolean;
    onDragStart?: (e: DragEvent, taskId: string) => void;
    
    // Todo / Plan state
    isInTodoList?: boolean;
    todoCompleted?: boolean;
    onRemoveFromTodo?: () => void;
    onToggleComplete?: () => void;
    
    // Display options
    showSprintGoal?: boolean;
    showAssignees?: boolean;
    showMetadata?: boolean; // Shows Module & Screen info
    showStatus?: boolean;
    
    // Custom label (from daily meeting)
    categoryLabel?: { text: string; color: string; icon: React.ReactNode };
    
    // Blocker info (from daily meeting)
    blockedByLabel?: string;
    
    // External actions (e.g., Quick Add buttons)
    actions?: React.ReactNode;
}

/**
 * A unified, high-contrast task card component used across the whole application.
 * Optimized for light mode with a premium aesthetic featuring #1D3557 accent.
 */
export function TaskCard({
    task,
    isHighRisk = false,
    onTaskClick,
    isDraggable = false,
    onDragStart,
    isInTodoList = false,
    todoCompleted = false,
    onRemoveFromTodo,
    onToggleComplete,
    showSprintGoal = false,
    showAssignees = false,
    showMetadata = true,
    showStatus = true,
    categoryLabel,
    blockedByLabel,
    actions,
}: TaskCardProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [mouseDownPos, setMouseDownPos] = useState<{ x: number; y: number } | null>(null);

    const handleMouseDown = (e: React.MouseEvent) => {
        setMouseDownPos({ x: e.clientX, y: e.clientY });
        setIsDragging(false);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (mouseDownPos) {
            const dx = Math.abs(e.clientX - mouseDownPos.x);
            const dy = Math.abs(e.clientY - mouseDownPos.y);
            if (dx > 5 || dy > 5) {
                setIsDragging(true);
            }
        }
    };

    const handleMouseUp = (e: React.MouseEvent) => {
        if (mouseDownPos && !isDragging) {
            const target = e.target as HTMLElement;
            const isInteractiveElement = target.closest('button') || target.closest('input') || target.closest('a') || target.closest('select');
            if (!isInteractiveElement) {
                onTaskClick(task.taskId);
            }
        }
        setMouseDownPos(null);
        setIsDragging(false);
    };

    const handleDragStart = (e: DragEvent) => {
        setIsDragging(true);
        onDragStart?.(e, task.taskId);
    };

    const handleDragEnd = () => {
        setIsDragging(false);
        setMouseDownPos(null);
    };

    const isMetGoal = hasMetSprintGoal(task.currentStatus, task.sprintGoal);

    return (
        <div
            draggable={isDraggable}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            className={`w-full text-left rounded-xl border px-3 py-2.5 transition-all group cursor-pointer shadow-sm relative overflow-hidden backdrop-blur-sm ${
                isDraggable ? 'active:cursor-grabbing active:scale-[0.98] active:shadow-none' : ''
            } ${
                todoCompleted
                    ? 'border-emerald-300 bg-emerald-50/80 opacity-70'
                    : isHighRisk
                        ? 'border-rose-300 bg-rose-50/90 hover:border-rose-400 hover:bg-rose-100 shadow-rose-100'
                        : task.isStale
                            ? 'border-amber-300 bg-amber-50/90 hover:border-amber-400 hover:bg-amber-100'
                            : 'border-border bg-card hover:border-[#1D3557]/40 hover:bg-secondary/50 hover:shadow-xl hover:shadow-[#1D3557]/5'
            }`}
        >
            {/* High risk indicator stripe */}
            {isHighRisk && (
                <div className="absolute top-0 left-0 w-1.5 h-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.3)]" />
            )}
            
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    {/* Drag Handle */}
                    {isDraggable && (
                        <GripVertical className="w-3.5 h-3.5 text-muted-foreground/30 mt-1 flex-shrink-0 cursor-grab group-hover:text-[#1D3557] transition-colors" />
                    )}
                    
                    {/* Todo Checkbox */}
                    {isInTodoList && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleComplete?.();
                            }}
                            className={`w-5 h-5 rounded-lg border mt-0.5 flex-shrink-0 flex items-center justify-center transition-all ${
                                todoCompleted
                                    ? 'bg-emerald-600 border-emerald-500 text-white shadow-sm'
                                    : 'border-muted-foreground/20 bg-background hover:border-[#1D3557] hover:bg-blue-50/50'
                            }`}
                        >
                            {todoCompleted && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </button>
                    )}

                    {/* Content */}
                    <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-black font-mono text-[9px] uppercase tracking-tighter text-muted-foreground/40 group-hover:text-[#1D3557]/60 transition-colors">
                                {task.taskId}
                            </span>
                            {isHighRisk && (
                                <span className="text-rose-500 text-[10px] font-bold animate-pulse">Critical Path</span>
                            )}
                            {task.riskLevel === 'critical' && !isHighRisk && (
                                <span className="px-1.5 py-0.5 rounded-full bg-rose-100 border border-rose-300 text-rose-700 text-[7px] font-black uppercase tracking-widest animate-pulse">DOOM</span>
                            )}
                        </div>
                        <span className={`text-[13px] font-bold truncate leading-tight group-hover:text-[#1D3557] transition-colors ${todoCompleted ? 'line-through text-muted-foreground/60' : 'text-foreground'}`}>
                            {task.taskName}
                        </span>

                        {/* Module & Screen Metadata */}
                        {showMetadata && (task.module || task.screen) && (
                            <div className="flex items-center gap-1.5 mt-1.5">
                                {task.module && (
                                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#1D3557]/5 border border-[#1D3557]/10 text-[#1D3557] text-[9px] font-bold">
                                        <Layout className="w-2.5 h-2.5 opacity-70" />
                                        <span className="uppercase tracking-wide">{task.module}</span>
                                    </div>
                                )}
                                {task.screen && (
                                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-secondary text-muted-foreground text-[9px] font-medium border border-border/40">
                                        <Monitor className="w-2.5 h-2.5 opacity-60" />
                                        <span className="truncate max-w-[120px]">{task.screen}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Actions Area */}
                <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="flex items-center opacity-0 group-hover:opacity-100 transition-all transform translate-x-1 group-hover:translate-x-0">
                        {isInTodoList && onRemoveFromTodo && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onRemoveFromTodo();
                                }}
                                className="p-1.5 hover:bg-rose-50 rounded-xl text-rose-500 transition-all active:scale-90"
                                title="Remove deployment"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        )}
                        {actions && <div className="ml-1">{actions}</div>}
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/20 group-hover:text-[#1D3557] transition-all flex-shrink-0" />
                </div>
            </div>

            {/* Status Footer */}
            <div className="flex items-center gap-2.5 mt-2.5 flex-wrap">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 shadow-sm ${priorityDotColor(task.currentStatus)}`} />
                {showStatus && <StatusBadge status={task.currentStatus} />}
                
                {categoryLabel && (
                    <div className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full flex items-center gap-1.5 shadow-sm border border-transparent ${categoryLabel.color}`}>
                        {categoryLabel.icon}
                        {categoryLabel.text}
                    </div>
                )}

                {blockedByLabel && (
                    <div className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-rose-100 text-rose-700  flex items-center gap-1.5 shadow-sm border border-rose-200/50">
                        <Users className="w-2.5 h-2.5" />
                        Blocker: {blockedByLabel}
                    </div>
                )}
                
                {task.isStale && (
                    <div className="text-[8px] font-black uppercase tracking-tighter text-amber-600 bg-amber-50/50 px-2 py-0.5 rounded-full border border-amber-200/50 flex items-center gap-1.5 shadow-sm">
                        <Clock className="w-2.5 h-2.5" />
                        STALE {formatStaleHours(task.staleDurationMs)}
                    </div>
                )}
            </div>

            {/* Assignees Footer */}
            {showAssignees && task.currentPerson && (
                <div className="mt-2.5 pt-2.5 border-t border-border/40 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground/60">
                        <Users className="w-3.5 h-3.5 opacity-40 text-[#1D3557]" />
                        <span className="truncate max-w-[200px] uppercase tracking-tight">{task.currentPerson}</span>
                    </div>
                    <div className="w-1.5 h-1.5 rounded-full bg-[#1D3557]/10" />
                </div>
            )}

            {/* Goal Footer */}
            {showSprintGoal && task.sprintGoal && (
                <div className={`mt-2.5 pt-2.5 border-t border-border/40 group/goal transition-all ${isMetGoal ? 'border-emerald-200/50' : ''}`}>
                    <div className={`flex items-center gap-2 text-[10px] font-bold ${isMetGoal ? 'text-emerald-700' : 'text-muted-foreground/50'}`}>
                        {isMetGoal ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                            <Target className="w-3.5 h-3.5 opacity-30 group-hover/goal:opacity-60 transition-opacity text-[#1D3557]" />
                        )}
                        <span className="truncate flex-1 font-semibold uppercase tracking-tight">{task.sprintGoal}</span>
                        {isMetGoal && (
                            <span className="text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full text-emerald-700 bg-emerald-50 border-emerald-200/50 shadow-sm ring-2 ring-emerald-50/50">MET</span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
