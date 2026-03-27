import React from 'react';
import { Zap } from 'lucide-react';
import { getStatusSeverity, isBottleneckStatus } from '@/lib/workflow-engine';

/**
 * Returns a Tailwind class string for a status indicator dot.
 * Optimized for high-contrast light mode.
 */
export function priorityDotColor(status: string): string {
    const s = status.trim();
    if (s === 'Reprocess') return 'bg-rose-600 shadow-[0_0_8px_rgba(225,29,72,0.4)] animate-pulse';
    if (s === 'Waiting to Integrate') return 'bg-amber-600 shadow-[0_0_8px_rgba(217,119,6,0.4)] animate-pulse';
    if (s === 'Designing') return 'bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.3)]';
    if (s === 'Ready for dev') return 'bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.3)]';
    if (s === 'In Process') return 'bg-[#1D3557] shadow-[0_0_8px_rgba(29,53,87,0.3)]';
    if (s === 'Reviewing') return 'bg-indigo-600 shadow-[0_0_8px_rgba(79,70,229,0.3)]';
    if (s === 'Testing') return 'bg-teal-600 shadow-[0_0_8px_rgba(13,148,136,0.3)]';
    if (s === 'Bug Fixing') return 'bg-orange-600 shadow-[0_0_8px_rgba(234,88,12,0.3)]';
    if (s === 'Staging Passed' || s === 'Completed') return 'bg-emerald-600 shadow-[0_0_8px_rgba(5,150,105,0.4)]';
    if (s === 'Not Started') return 'bg-zinc-400';
    return 'bg-zinc-500';
}

/**
 * Renders a high-contrast status badge component.
 * Optimized for light mode with a "premium" aesthetic.
 */
export function StatusBadge({ status }: { status: string }) {
    const severity = getStatusSeverity(status);
    const isBottleneck = isBottleneckStatus(status);
    
    // Light mode optimized semantic classes
    const classes: Record<string, string> = {
        normal: 'bg-zinc-100 text-zinc-700 border-zinc-200/60',
        high: 'bg-amber-50 text-amber-700 border-amber-200/60 shadow-sm shadow-amber-500/5',
        critical: 'bg-rose-50 text-rose-700 border-rose-200/60 shadow-sm shadow-rose-500/5',
    };

    // Special handling for success states
    const isSuccess = status === 'Completed' || status === 'Staging Passed';
    const finalClasses = isSuccess 
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
        : classes[severity] || classes.normal;

    return (
        <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-mono font-bold tracking-tight transition-all duration-300 ${finalClasses}`}>
            {isBottleneck && <Zap className="w-2.5 h-2.5 mr-1 text-amber-500 fill-amber-500/20" />}
            {status}
        </span>
    );
}

/**
 * Formats stale duration for display.
 */
export function formatStaleHours(ms: number): string {
    const hours = Math.floor(ms / 3600000);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}
