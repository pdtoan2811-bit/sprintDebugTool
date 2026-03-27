import React, { useState } from 'react';
import { TaskAnalysis } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover';
import { CheckCircle2, Circle, RefreshCw, X } from 'lucide-react';
import { PersonMeetingData } from './types';
import { useDailyTodos } from '@/lib/hooks/useDailyTodos';

export interface SyncTaskDropdownProps {
    task: TaskAnalysis;
    allPersonData: PersonMeetingData[];
    personData: PersonMeetingData;
    dateStr: string;
    dailyTodos: ReturnType<typeof useDailyTodos>;
}

export function SyncTaskDropdown({
    task,
    allPersonData,
    personData,
    dateStr,
    dailyTodos
}: SyncTaskDropdownProps) {
    const [selectedPersons, setSelectedPersons] = useState<Set<string>>(new Set());
    const [isOpen, setIsOpen] = useState(false);

    const otherPersons = allPersonData.filter(p => p.person !== personData.person);

    const handleSync = () => {
        selectedPersons.forEach(person => {
            dailyTodos.addTodo(person, dateStr, task.taskId);
        });
        setIsOpen(false);
        setSelectedPersons(new Set());
    };

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <div onClick={(e) => e.stopPropagation()}>
                    <button
                        className={`p-1.5 rounded-xl transition-all ml-1 border shadow-sm active:scale-90 ${isOpen ? 'bg-indigo-600 text-white border-indigo-500 shadow-indigo-600/20' : 'bg-secondary/50 border-border/50 text-muted-foreground/60 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-indigo-900/10 hover:border-indigo-500/30'}`}
                        title="Sync task to others"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isOpen ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0 z-[100] border-border bg-card shadow-2xl rounded-2xl overflow-hidden" align="end" onClick={(e) => e.stopPropagation()}>
                <div className="p-4 border-b border-border/50 bg-secondary/30">
                    <div className="flex items-center justify-between mb-1">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-foreground">Sync Protocol</h4>
                        <button onClick={() => setIsOpen(false)} className="p-1 rounded-lg hover:bg-secondary text-muted-foreground/40 hover:text-foreground transition-all">
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    <p className="text-[10px] font-bold text-muted-foreground/60 leading-relaxed italic">Distribute objective to auxiliary squad members.</p>
                </div>
                
                <div className="p-2 space-y-1 max-h-60 overflow-y-auto custom-scrollbar">
                    {otherPersons.map(p => {
                        const isSelected = selectedPersons.has(p.person);
                        const alreadyHasIt = dailyTodos.getTodosForPersonDate(p.person, dateStr).some(t => t.taskId === task.taskId);
                        
                        return (
                            <button
                                key={p.person}
                                disabled={alreadyHasIt}
                                onClick={() => {
                                    const next = new Set(selectedPersons);
                                    if (next.has(p.person)) next.delete(p.person);
                                    else next.add(p.person);
                                    setSelectedPersons(next);
                                }}
                                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-all border ${
                                    alreadyHasIt 
                                        ? 'opacity-40 cursor-not-allowed bg-secondary/50 border-transparent' 
                                        : isSelected 
                                            ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/30 dark:border-indigo-800' 
                                            : 'hover:bg-secondary border-transparent'
                                }`}
                            >
                                <div className="flex flex-col items-start">
                                    <span className={`font-bold transition-colors ${alreadyHasIt ? 'text-muted-foreground' : 'text-foreground'}`}>
                                        {p.person}
                                    </span>
                                    {alreadyHasIt && (
                                        <span className="text-[8px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-500 mt-0.5">Active Assignment</span>
                                    )}
                                </div>
                                
                                {alreadyHasIt ? (
                                    <div className="w-5 h-5 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-500" />
                                    </div>
                                ) : isSelected ? (
                                    <div className="w-5 h-5 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/20">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                                    </div>
                                ) : (
                                    <Circle className="w-5 h-5 text-muted-foreground/20" />
                                )}
                            </button>
                        );
                    })}
                </div>
                
                <div className="p-3 bg-secondary/20 border-t border-border/50 flex items-center justify-between">
                    <button 
                        onClick={() => setIsOpen(false)}
                        className="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 hover:text-foreground hover:bg-secondary transition-all"
                    >
                        Abort
                    </button>
                    <button 
                        onClick={handleSync}
                        disabled={selectedPersons.size === 0}
                        className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all active:scale-95"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${selectedPersons.size > 0 ? 'animate-spin-slow' : ''}`} />
                        Initiate Sync ({selectedPersons.size})
                    </button>
                </div>
            </PopoverContent>
        </Popover>
    );
}
