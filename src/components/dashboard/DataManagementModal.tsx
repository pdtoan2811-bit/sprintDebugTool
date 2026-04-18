'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Archive, Database, Download, Upload, Trash2, AlertTriangle, FileText, CheckCircle2, X, RotateCcw } from 'lucide-react';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet';
import { useNotes } from '@/lib/hooks/useNotes';
import { useMeetingNotes } from '@/lib/hooks/useMeetingNotes';
import { useHighRisk } from '@/lib/hooks/useHighRisk';
import { useSprintConfig } from '@/lib/hooks/useSprintConfig';
import { ArchivedTaskEntry } from '@/lib/hooks/useArchivedTasks';

interface DataManagementModalProps {
    archivedTasks: ArchivedTaskEntry[];
    onUnarchiveTask: (taskId: string) => void;
}

export function DataManagementModal({ archivedTasks, onUnarchiveTask }: DataManagementModalProps) {
    const { notes, isLoaded: isNotesLoaded } = useNotes();
    const { getAllNotes: getMeetingNotes, isLoaded: isMeetingNotesLoaded } = useMeetingNotes();
    const { highRiskIds, isLoaded: isHighRiskLoaded } = useHighRisk();
    const { configs, manualOverride, isLoaded: isSprintConfigLoaded } = useSprintConfig();
    const [isOpen, setIsOpen] = useState(false);
    const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [importErrorMsg, setImportErrorMsg] = useState('');
    const [isMounted, setIsMounted] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    if (!isMounted) {
        return null;
    }

    const allLoaded = isNotesLoaded && isMeetingNotesLoaded && isHighRiskLoaded && isSprintConfigLoaded;

    // Calculate stats for display safely
    const notesCount = allLoaded ? Object.keys(notes).length : 0;
    const meetingNotesData = allLoaded ? getMeetingNotes() : {};
    const meetingNotesCount = allLoaded ? Object.values(meetingNotesData).reduce((sum, taskNotes) => sum + taskNotes.length, 0) : 0;
    const blockersCount = allLoaded ? highRiskIds.size : 0;

    const handleExport = async () => {
        try {
            const res = await fetch('/api/data');
            const data = await res.json();

            const jsonString = JSON.stringify(data, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            const date = new Date().toISOString().split('T')[0];
            link.download = `sprint-debugger-backup-${date}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Export failed', error);
        }
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const content = event.target?.result as string;
                const data = JSON.parse(content);

                // Validate it looks like our backup format
                if (typeof data !== 'object' || data === null) {
                    throw new Error("Invalid file format");
                }

                // Restore items via API
                const res = await fetch('/api/data', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });

                if (!res.ok) throw new Error("Server failed to write imported data.");

                setImportStatus('success');
                // Reload the page to apply changes
                setTimeout(() => {
                    window.location.reload();
                }, 1500);

            } catch (err) {
                setImportStatus('error');
                setImportErrorMsg(err instanceof Error ? err.message : 'Unknown error during import');
            }
        };
        reader.readAsText(file);

        // Reset input so the same file could be selected again
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleClearData = async () => {
        if (confirm("Are you sure you want to clear ALL Git-synced data? This will overwrite the local JSON file. This cannot be undone unless you have a backup or Git history.")) {
            try {
                const res = await fetch('/api/data?all=true', { method: 'DELETE' });
                if (res.ok) {
                    window.location.reload();
                } else {
                    alert("Failed to clear data via API");
                }
            } catch (e) {
                console.error(e);
            }
        }
    };

    return (
        <Sheet open={isOpen} onOpenChange={(open) => {
            setIsOpen(open);
            if (!open) {
                setTimeout(() => setImportStatus('idle'), 300);
            }
        }}>
            <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2.5 font-black uppercase tracking-widest text-[10px] rounded-xl border-border/50 bg-secondary/30 hover:bg-secondary hover:border-border transition-all">
                    <Database className="h-3.5 w-3.5 text-indigo-500" />
                    Vault & Config
                </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[400px] sm:w-[500px] flex flex-col gap-0 p-0 border-l border-border bg-card/95 backdrop-blur-xl shadow-2xl">
                <div className="p-6 border-b border-border/50 bg-secondary/20 relative">
                    <SheetHeader>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 rounded-xl bg-indigo-600 shadow-lg shadow-indigo-600/20">
                                <Database className="h-5 w-5 text-white" />
                            </div>
                            <SheetTitle className="text-sm font-black uppercase tracking-[0.2em] text-foreground">
                                Data Management
                            </SheetTitle>
                        </div>
                        <SheetDescription className="text-xs font-bold text-muted-foreground/60 leading-relaxed italic pr-8">
                            Control technical telemetry, persistent notations, and core sprint configurations. All adjustments are locally synchronized.
                        </SheetDescription>
                    </SheetHeader>
                    
                    <button onClick={() => setIsOpen(false)} className="absolute top-6 right-6 p-1.5 rounded-lg hover:bg-secondary text-muted-foreground/40 hover:text-foreground transition-all">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="flex-1 p-6 overflow-y-auto custom-scrollbar flex flex-col gap-6">
                    {/* Stats Grid */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 px-1">
                            <FileText className="h-3.5 w-3.5 text-indigo-500" />
                            <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-foreground/80">
                                Local Registry Status
                            </h3>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 rounded-xl bg-secondary/30 border border-border/50 shadow-sm flex flex-col gap-1 hover:border-indigo-500/30 transition-all group">
                                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 group-hover:text-indigo-500 transition-colors">Notations</span>
                                <span className="text-2xl font-black text-foreground">{notesCount}</span>
                                <div className="mt-2 w-8 h-1 rounded-full bg-indigo-500/20 group-hover:w-16 transition-all" />
                            </div>
                            <div className="p-3 rounded-xl bg-secondary/30 border border-border/50 shadow-sm flex flex-col gap-1 hover:border-indigo-500/30 transition-all group">
                                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 group-hover:text-indigo-500 transition-colors">Meeting Logs</span>
                                <span className="text-2xl font-black text-foreground">{meetingNotesCount}</span>
                                <div className="mt-2 w-8 h-1 rounded-full bg-indigo-500/20 group-hover:w-16 transition-all" />
                            </div>
                            <div className="p-4 rounded-2xl bg-secondary/30 border border-border/50 shadow-sm flex flex-col gap-1 hover:border-rose-500/30 transition-all group">
                                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 group-hover:text-rose-500 transition-colors">High Risk Markers</span>
                                <span className="text-2xl font-black text-foreground">{blockersCount}</span>
                                <div className="mt-2 w-8 h-1 rounded-full bg-rose-500/20 group-hover:w-16 transition-all" />
                            </div>
                            <div className="p-3 rounded-xl bg-secondary/30 border border-border/50 shadow-sm flex flex-col gap-1 hover:border-indigo-500/30 transition-all group">
                                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 group-hover:text-indigo-500 transition-colors">Sprint Parameters</span>
                                <span className="text-2xl font-black text-foreground">{configs.length}</span>
                                <div className="mt-2 w-8 h-1 rounded-full bg-indigo-500/20 group-hover:w-16 transition-all" />
                            </div>
                        </div>
                    </div>

                    <div className="h-px bg-border/50" />

                    {/* Actions */}
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 px-1">
                                <Download className="h-3.5 w-3.5 text-indigo-500" />
                                <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-foreground/80">Backup & Recovery</h3>
                            </div>
                            <p className="text-[10px] font-bold text-muted-foreground/50 leading-relaxed px-1">
                                Generate a cryptographic package of all current local states or restore from an existing protocol backup.
                            </p>
                        </div>

                        <input
                            type="file"
                            accept=".json"
                            className="hidden"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                        />

                        <div className="grid grid-cols-2 gap-3">
                            <Button variant="default" className="h-11 rounded-lg text-[10px] font-black uppercase tracking-widest gap-2 bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 transition-all active:scale-95" onClick={handleExport}>
                                <Download className="h-4 w-4" />
                                Export Vault
                            </Button>
                            <Button variant="outline" className="h-11 rounded-lg text-[10px] font-black uppercase tracking-widest gap-2 border-border hover:bg-secondary transition-all active:scale-95" onClick={handleImportClick}>
                                <Upload className="h-4 w-4" />
                                Restore Protocol
                            </Button>
                        </div>

                        {importStatus === 'success' && (
                            <div className="bg-emerald-50 text-emerald-700 p-4 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 border border-emerald-200 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="p-1 rounded-lg bg-emerald-500 text-white">
                                    <CheckCircle2 className="h-4 w-4" />
                                </div>
                                Telemetry loaded. System reboot imminent.
                            </div>
                        )}

                        {importStatus === 'error' && (
                            <div className="bg-rose-50 text-rose-700 p-4 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 border border-rose-200 animate-in shake duration-300">
                                <div className="p-1 rounded-lg bg-rose-500 text-white">
                                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                </div>
                                System mismatch: {importErrorMsg}
                            </div>
                        )}
                    </div>

                    <div className="h-px bg-border/50" />

                    {/* Archived Tasks */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-1">
                            <div className="flex items-center gap-2">
                                <Archive className="h-3.5 w-3.5 text-violet-500" />
                                <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-foreground/80">Archived Tasks</h3>
                            </div>
                            <span className="text-[10px] font-black text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/30 px-2 py-0.5 rounded-full border border-violet-200 dark:border-violet-800/50">
                                {archivedTasks.length}
                            </span>
                        </div>
                        <p className="text-[10px] font-bold text-muted-foreground/50 leading-relaxed px-1">
                            Tasks hidden from all views. Google Sheet data is never touched — restore anytime to bring them back.
                        </p>

                        {archivedTasks.length === 0 ? (
                            <div className="text-center py-8 bg-secondary/20 rounded-xl border border-dashed border-border/60">
                                <Archive className="w-8 h-8 mx-auto mb-3 opacity-10 text-violet-500" />
                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/30">No archived tasks</p>
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                                {archivedTasks
                                    .sort((a, b) => new Date(b.archivedAt).getTime() - new Date(a.archivedAt).getTime())
                                    .map((entry) => (
                                    <div
                                        key={entry.taskId}
                                        className="group flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border/50 bg-secondary/20 hover:bg-secondary/40 transition-all shadow-sm"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[9px] font-black font-mono text-muted-foreground/50 uppercase tracking-tight">{entry.taskId}</span>
                                                <span className="text-[8px] font-bold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/30 px-1.5 py-0.5 rounded border border-violet-200/50 dark:border-violet-800/30">
                                                    {entry.lastStatus}
                                                </span>
                                            </div>
                                            <p className="text-[11px] font-bold text-foreground truncate leading-tight">{entry.taskName}</p>
                                            <div className="flex items-center gap-3 mt-1">
                                                <span className="text-[9px] font-bold text-muted-foreground/40">{entry.person}</span>
                                                <span className="text-[9px] font-bold text-muted-foreground/30">
                                                    Archived {new Date(entry.archivedAt).toLocaleDateString()}
                                                </span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => onUnarchiveTask(entry.taskId)}
                                            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-[9px] font-black uppercase tracking-widest hover:bg-violet-700 transition-all active:scale-95 shadow-md shadow-violet-600/20 opacity-0 group-hover:opacity-100"
                                        >
                                            <RotateCcw className="w-3 h-3" />
                                            Restore
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="mt-auto pt-6 border-t border-border/50">
                        <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/20 space-y-4">
                            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                                <AlertTriangle className="h-4 w-4" />
                                <h3 className="text-[10px] font-black uppercase tracking-widest">Critical Override</h3>
                            </div>
                            <p className="text-[9px] font-bold text-rose-700/60 dark:text-rose-400/60 leading-relaxed italic">
                                Executing a wipe will purge all local registries. This operation cannot be reversed without an external backup.
                            </p>
                            <Button variant="destructive" className="w-full h-10 rounded-lg text-[10px] font-black uppercase tracking-widest gap-2 bg-rose-600 hover:bg-rose-700 shadow-lg shadow-rose-600/20 transition-all active:scale-95" onClick={handleClearData}>
                                <Trash2 className="h-4 w-4" />
                                Purge All Data
                            </Button>
                        </div>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
