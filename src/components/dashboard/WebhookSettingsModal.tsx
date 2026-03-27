'use client';

import React, { useState, useEffect } from 'react';
import { useWebhooks } from '@/lib/hooks/useWebhooks';
import { 
    X, 
    Send, 
    Loader2, 
    Link as LinkIcon, 
    User, 
    CheckCircle2, 
    AlertCircle,
    Copy,
    Globe,
    RefreshCw
} from 'lucide-react';
import { Badge } from '../ui/badge';
import { WORKFLOW_STATUSES } from '@/lib/types';
import { useSprintConfig } from '@/lib/hooks/useSprintConfig';

interface WebhookSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    persons: string[];
    initialPerson?: string | null;
    activeSprint?: string;
}

export function WebhookSettingsModal({
    isOpen,
    onClose,
    persons,
    initialPerson,
    activeSprint
}: WebhookSettingsModalProps) {
    const { webhooks, updateWebhook, isLoading } = useWebhooks();
    const { configs } = useSprintConfig();
    const [selectedPerson, setSelectedPerson] = useState<string>(initialPerson || persons[0] || '');
    const [testWebhookUrl, setTestWebhookUrl] = useState('');
    const [testTaskUrl, setTestTaskUrl] = useState('');
    const [testCurrentSprint, setTestCurrentSprint] = useState(activeSprint || '8');
    const [testNextSprint, setTestNextSprint] = useState(activeSprint ? String(parseInt(activeSprint) + 1) : '9');
    const [testStatus, setTestStatus] = useState('In Process');
    const [testSprintGoal, setTestSprintGoal] = useState('Completed');
    const [isTesting, setIsTesting] = useState(false);
    const [simulateMoved, setSimulateMoved] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string; data?: any } | null>(null);

    useEffect(() => {
        if (selectedPerson && webhooks[selectedPerson]) {
            setTestWebhookUrl(webhooks[selectedPerson]);
        } else {
            setTestWebhookUrl('');
        }
    }, [selectedPerson, webhooks]);

    if (!isOpen) return null;

    const handleSave = async (person: string, url: string) => {
        await updateWebhook(person, url);
    };

    const handleRunTest = async () => {
        if (!testWebhookUrl) return;

        setIsTesting(true);
        setTestResult(null);

        try {
            const payload = {
                person: selectedPerson,
                currentSprint: testCurrentSprint,
                nextSprint: testNextSprint,
                webhookUrl: testWebhookUrl,
                date: new Date().toISOString().split('T')[0],
                todos: [
                    {
                        order: 1,
                        taskId: 'TEST-123',
                        taskName: simulateMoved ? '🚀 Test: Moving to Next Sprint' : '📝 Sample Task for Testing',
                        status: testStatus, 
                        sprintGoal: testSprintGoal,
                        recordLink: testTaskUrl || 'https://example.larksuite.com/task/test-123',
                        tag: simulateMoved ? 'Moved to Next Sprint' : testStatus,
                        isMoved: simulateMoved
                    }
                ],
                summary: {
                    total: 1,
                    completed: 0,
                    blocked: 0
                },
                isTest: true
            };

            const response = await fetch('/api/send-todo-webhook', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            
            if (response.ok && data.success) {
                setTestResult({
                    success: true,
                    message: 'Successfully sent to Lark!',
                    data: data.data
                });
            } else {
                setTestResult({
                    success: false,
                    message: data.error || `HTTP Error ${response.status}`,
                    data: data
                });
            }
        } catch (error) {
            setTestResult({
                success: false,
                message: error instanceof Error ? error.message : 'Unknown communication error'
            });
        } finally {
            setIsTesting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
            <div className="w-full max-w-2xl bg-card border border-border rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="flex justify-between items-center p-6 border-b border-border/50 bg-secondary/20 relative">
                    <div className="flex items-center gap-4">
                        <div className="p-2.5 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-600/20">
                            <Send className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-foreground">Automation Protocol</h3>
                            <p className="text-[10px] font-bold text-muted-foreground/60 italic mt-1">Configure and test Lark synchronization targets.</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-2 hover:bg-secondary rounded-xl text-muted-foreground/40 hover:text-foreground transition-all active:scale-90"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
                    {/* Management Section */}
                    <section className="space-y-6">
                        <div className="flex items-center gap-2.5 px-1">
                            <User className="w-4 h-4 text-indigo-500" />
                            <h4 className="text-[10px] font-black uppercase tracking-[0.15em] text-foreground/80">Squad Webhook Registry</h4>
                        </div>
                        
                        <div className="grid gap-3">
                            {persons.map(person => (
                                <div key={person} className="flex flex-col sm:flex-row sm:items-center gap-3 bg-secondary/30 p-3 rounded-xl border border-border/50 hover:border-indigo-500/30 transition-all group">
                                    <div className="flex items-center gap-3 min-w-[160px]">
                                        <div className="w-8 h-8 rounded-lg bg-white dark:bg-black/20 flex items-center justify-center text-[10px] font-black text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform shadow-sm">
                                            {person.substring(0, 2).toUpperCase()}
                                        </div>
                                        <span className="text-xs font-black uppercase tracking-tight text-foreground/70">{person}</span>
                                    </div>
                                    <div className="flex-1 relative">
                                        <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/30" />
                                        <input
                                            type="text"
                                            defaultValue={webhooks[person] || ''}
                                            placeholder="https://...larksuite.com/..."
                                            onBlur={(e) => handleSave(person, e.target.value)}
                                            className="w-full bg-background border border-border rounded-xl pl-11 pr-4 py-2.5 text-xs text-foreground/80 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all placeholder:text-muted-foreground/30 shadow-sm"
                                        />
                                    </div>
                                    {webhooks[person] && (
                                        <div className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 text-[9px] font-black uppercase tracking-widest border border-emerald-200/50">
                                            Linked
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>

                    <div className="h-px bg-border/50" />

                    {/* Test Section */}
                    <section className="space-y-6">
                        <div className="flex items-center gap-2.5 px-1">
                            <RefreshCw className="w-4 h-4 text-indigo-500" />
                            <h4 className="text-[10px] font-black uppercase tracking-[0.15em] text-foreground/80">Diagnostic Testbed</h4>
                        </div>

                        <div className="bg-indigo-50/20 dark:bg-indigo-950/10 border border-indigo-100 dark:border-indigo-900/30 rounded-xl p-5 space-y-5 shadow-sm">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Mock Deployment For</label>
                                    <select
                                        value={selectedPerson}
                                        onChange={(e) => setSelectedPerson(e.target.value)}
                                        className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all appearance-none cursor-pointer shadow-sm"
                                    >
                                        {persons.map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Simulation Link</label>
                                    <div className="relative">
                                        <LinkIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/30" />
                                        <input
                                            type="text"
                                            value={testTaskUrl}
                                            onChange={(e) => setTestTaskUrl(e.target.value)}
                                            placeholder="Optional task record link"
                                            className="w-full bg-background border border-border rounded-xl pl-11 pr-4 py-2.5 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-muted-foreground/30 shadow-sm"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Current Cycle</label>
                                    <select
                                        value={testCurrentSprint}
                                        onChange={(e) => setTestCurrentSprint(e.target.value)}
                                        className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-xs font-black text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all appearance-none cursor-pointer shadow-sm"
                                    >
                                        {configs.map(c => <option key={c.number} value={c.number}>Cycle {c.number}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Forward Cycle</label>
                                    <select
                                        value={testNextSprint}
                                        onChange={(e) => setTestNextSprint(e.target.value)}
                                        className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-xs font-black text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all appearance-none cursor-pointer shadow-sm"
                                    >
                                        {configs.map(c => <option key={c.number} value={c.number}>Cycle {c.number}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Mock Status</label>
                                    <select
                                        value={testStatus}
                                        onChange={(e) => setTestStatus(e.target.value)}
                                        className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all appearance-none cursor-pointer shadow-sm"
                                    >
                                        {WORKFLOW_STATUSES.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Mock Goal Vector</label>
                                    <select
                                        value={testSprintGoal}
                                        onChange={(e) => setTestSprintGoal(e.target.value)}
                                        className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all appearance-none cursor-pointer shadow-sm"
                                    >
                                        {WORKFLOW_STATUSES.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Endpoint Verification</label>
                                <input
                                    type="text"
                                    value={testWebhookUrl}
                                    onChange={(e) => setTestWebhookUrl(e.target.value)}
                                    placeholder="Verify endpoint URL before transmission"
                                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-xs font-mono text-indigo-600 dark:text-indigo-400 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
                                />
                            </div>
                            
                            <div className="flex items-center gap-3 p-3 bg-indigo-600/5 border border-indigo-500/20 rounded-xl group cursor-pointer hover:bg-indigo-600/10 transition-all" onClick={() => setSimulateMoved(!simulateMoved)}>
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${simulateMoved ? 'bg-indigo-600 text-white shadow-lg' : 'bg-secondary text-muted-foreground/40'}`}>
                                    <RefreshCw className={`w-5 h-5 ${simulateMoved ? 'animate-spin-slow' : ''}`} />
                                </div>
                                <div className="flex-1">
                                    <h5 className="text-[10px] font-black uppercase tracking-widest text-foreground">Next-Cycle Propagation</h5>
                                    <p className="text-[9px] font-bold text-muted-foreground/60 italic">Simulate "Moved to Next Sprint" for this telemetry sample.</p>
                                </div>
                                <div className={`w-12 h-6 rounded-full relative transition-all ${simulateMoved ? 'bg-indigo-600' : 'bg-secondary'}`}>
                                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${simulateMoved ? 'left-7 shadow-md' : 'left-1'}`} />
                                </div>
                            </div>

                            <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-4">
                                <div className="flex items-center gap-3 p-3 bg-secondary/30 rounded-xl border border-border/50 max-w-sm">
                                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                                    <p className="text-[9px] font-bold text-muted-foreground/60 leading-tight italic">
                                        Diagnostic routines emit sample JSON payloads. Production registries remain unaffected by this operations.
                                    </p>
                                </div>
                                <button
                                    onClick={handleRunTest}
                                    disabled={isTesting || !testWebhookUrl}
                                    className="w-full md:w-auto flex items-center justify-center gap-3 px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-xl shadow-indigo-600/30 active:scale-95"
                                >
                                    {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                    Trigger Transmission
                                </button>
                            </div>

                            {/* Result Display */}
                            {testResult && (
                                <div className={`mt-5 rounded-xl border p-5 animate-in fade-in slide-in-from-top-4 duration-500 shadow-lg ${
                                    testResult.success 
                                        ? 'bg-emerald-50/50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-800 dark:text-emerald-300' 
                                        : 'bg-rose-50/50 border-rose-200 text-rose-800 dark:bg-rose-950/20 dark:border-rose-800 dark:text-rose-300'
                                }`}>
                                    <div className="flex items-start gap-4">
                                        <div className={`p-2 rounded-xl text-white ${testResult.success ? 'bg-emerald-600' : 'bg-rose-600'}`}>
                                            {testResult.success ? (
                                                <CheckCircle2 className="w-5 h-5" />
                                            ) : (
                                                <AlertCircle className="w-5 h-5 " />
                                            )}
                                        </div>
                                        <div className="flex-1 space-y-4">
                                            <div className="flex items-center justify-between">
                                                <h5 className="text-[10px] font-black uppercase tracking-widest opacity-80">
                                                    {testResult.success ? 'Diagnostic Passed' : 'Diagnostic Failure'}
                                                </h5>
                                                <span className="text-[9px] font-black uppercase tracking-widest opacity-40">
                                                    {new Date().toLocaleTimeString()}
                                                </span>
                                            </div>
                                            <p className="text-xs font-bold leading-relaxed">{testResult.message}</p>
                                            
                                            {testResult.data && (
                                                <div className="mt-4 relative group/code">
                                                    <div className="absolute top-3 right-3 opacity-0 group-hover/code:opacity-100 transition-all">
                                                        <button 
                                                            onClick={() => navigator.clipboard.writeText(JSON.stringify(testResult.data, null, 2))}
                                                            className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all text-white backdrop-blur-sm shadow-xl"
                                                            title="Copy sequence"
                                                        >
                                                            <Copy className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                    <pre className="text-[11px] bg-black/80 p-4 rounded-xl border border-white/5 overflow-x-auto custom-scrollbar font-mono text-emerald-400 leading-relaxed shadow-inner">
                                                        {JSON.stringify(testResult.data, null, 2)}
                                                    </pre>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>
                </div>

                <div className="p-6 border-t border-border/50 flex justify-end bg-secondary/20">
                    <button 
                        onClick={onClose}
                        className="px-8 py-2.5 bg-foreground/5 hover:bg-foreground/10 text-foreground text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all active:scale-95"
                    >
                        Close Diagnostics
                    </button>
                </div>
            </div>
        </div>
    );
}
