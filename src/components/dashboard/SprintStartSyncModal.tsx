'use client';

import React from 'react';
import { SyncStatus, SyncLogEntry } from '@/lib/hooks/useSprintStartSync';
import { 
    X, 
    CheckCircle2, 
    AlertCircle, 
    Loader2, 
    Send, 
    ExternalLink, 
    AlertTriangle,
    Check,
    User
} from 'lucide-react';

interface SprintStartSyncModalProps {
    isOpen: boolean;
    onClose: () => void;
    syncStatus: SyncStatus;
    sprint: string;
}

export function SprintStartSyncModal({
    isOpen,
    onClose,
    syncStatus,
    sprint
}: SprintStartSyncModalProps) {
    if (!isOpen) return null;

    const { isSyncing, current, total, logs } = syncStatus;
    const progress = total > 0 ? (current / total) * 100 : 0;
    
    const successCount = logs.filter(l => l.success).length;
    const failCount = logs.filter(l => !l.success).length;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-3xl bg-card border border-border rounded-xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex justify-between items-center p-5 border-b border-border/50 bg-secondary/30">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${isSyncing ? 'bg-indigo-100 dark:bg-indigo-900/30' : 'bg-emerald-100 dark:bg-emerald-900/30'}`}>
                            {isSyncing ? (
                                <Loader2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400 animate-spin" />
                            ) : (
                                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                            )}
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-foreground tracking-tight font-display">
                                {isSyncing ? 'Syncing Sprint to Lark...' : 'Sync Completed'}
                            </h3>
                            <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider opacity-70">
                                {isSyncing 
                                    ? `Sending Task ${current} of ${total} for Sprint ${sprint}` 
                                    : `Processed ${total} tasks for Sprint ${sprint}`}
                            </p>
                        </div>
                    </div>
                    {!isSyncing && (
                        <button 
                            onClick={onClose} 
                            className="p-2 hover:bg-muted rounded-full text-muted-foreground hover:text-foreground transition-all active:scale-90"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>

                {/* Progress Bar */}
                <div className="px-5 py-3 bg-muted/20 border-b border-border/50">
                    <div className="flex justify-between items-center mb-2.5">
                        <span className="text-[10px] font-black font-mono text-muted-foreground uppercase tracking-widest">Progress: {Math.round(progress)}%</span>
                        <div className="flex gap-4">
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-black uppercase tracking-widest flex items-center gap-1.5">
                                <CheckCircle2 className="w-3 h-3" /> {successCount} Success
                            </span>
                            <span className="text-[10px] text-red-600 dark:text-red-400 font-black uppercase tracking-widest flex items-center gap-1.5">
                                <AlertCircle className="w-3 h-3" /> {failCount} Failed
                            </span>
                        </div>
                    </div>
                    <div className="h-2.5 w-full bg-secondary rounded-full overflow-hidden shadow-inner p-0.5">
                        <div 
                            className={`h-full rounded-full transition-all duration-500 ease-out shadow-sm ${isSyncing ? 'bg-indigo-600 shadow-indigo-200 dark:shadow-indigo-900/50' : 'bg-emerald-500 shadow-emerald-200 dark:shadow-emerald-900/50'}`}
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>

                {/* Log Content */}
                <div className="flex-1 overflow-y-auto p-0 custom-scrollbar bg-background/50">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 bg-muted/90 backdrop-blur-md z-10 border-b border-border shadow-sm">
                            <tr>
                                <th className="px-5 py-2.5 text-[10px] font-black text-muted-foreground uppercase tracking-widest w-24">Status</th>
                                <th className="px-5 py-2.5 text-[10px] font-black text-muted-foreground uppercase tracking-widest w-32">Task ID</th>
                                <th className="px-5 py-2.5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Task Name & Person</th>
                                <th className="px-5 py-2.5 text-[10px] font-black text-muted-foreground uppercase tracking-widest w-40">Result</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                            {logs.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3 opacity-20">
                                            <Send className="w-10 h-10 text-muted-foreground" />
                                            <p className="text-sm font-black uppercase tracking-widest text-muted-foreground">Preparing to dispatch requests...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log, idx) => (
                                    <tr key={log.taskId + idx} className="hover:bg-muted/30 transition-colors group">
                                        <td className="px-6 py-4">
                                            {log.success ? (
                                                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest">
                                                    <div className="w-5 h-5 rounded-full bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center border border-emerald-100 dark:border-emerald-900/50">
                                                        <Check className="w-3 h-3" />
                                                    </div>
                                                    OK
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-[10px] font-black uppercase tracking-widest">
                                                    <div className="w-5 h-5 rounded-full bg-red-50 dark:bg-red-950/30 flex items-center justify-center border border-red-100 dark:border-red-900/50">
                                                        <AlertTriangle className="w-3 h-3" />
                                                    </div>
                                                    FAIL
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 font-mono text-[11px] text-muted-foreground font-bold break-all group-hover:text-foreground transition-colors opacity-70">
                                            {log.taskId}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-xs text-foreground font-semibold line-clamp-1 group-hover:text-primary transition-colors">
                                                    {log.taskName}
                                                </span>
                                                <span className="text-[10px] text-muted-foreground/60 font-bold uppercase tracking-tight flex items-center gap-1.5 mt-1">
                                                    <User className="w-2.5 h-2.5 opacity-40" />
                                                    {log.person}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-[10px]">
                                            {log.success ? (
                                                <span className="text-muted-foreground/60 italic font-medium">Accepted by Lark</span>
                                            ) : (
                                                <span className="text-red-600 dark:text-red-400/80 font-mono font-bold break-all bg-red-50 dark:bg-red-950/20 px-2 py-1 rounded border border-red-100 dark:border-red-900/50">
                                                    {log.error}
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-border bg-secondary/30 flex justify-between items-center shadow-lg transform-gpu">
                    <div className="flex items-center gap-2.5 text-[10px] text-muted-foreground font-black uppercase tracking-widest opacity-60">
                        <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
                        Live API Stream Enabled
                    </div>
                    <button 
                        onClick={onClose}
                        disabled={isSyncing}
                        className={`px-10 py-3 rounded-xl font-black uppercase tracking-widest text-[11px] transition-all border shadow-sm ${
                            isSyncing 
                                ? 'bg-secondary text-muted-foreground/40 border-border cursor-not-allowed' 
                                : 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-500/30 shadow-indigo-200 dark:shadow-indigo-900/40 active:scale-95'
                        }`}
                    >
                        {isSyncing ? 'Dispatching...' : 'Done'}
                    </button>
                </div>
            </div>
        </div>
    );
}
