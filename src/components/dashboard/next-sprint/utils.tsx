import React from 'react';
import { getStatusSeverity, isBottleneckStatus } from '@/lib/workflow-engine';
import { Zap } from 'lucide-react';

export const ACTIVE_STATUSES = new Set([
    'In Process',
    'Bug Fixing',
    'Testing',
    'Reviewing',
]);

export function priorityDotColor(status: string): string {
    if (status === 'Reprocess') return 'bg-red-500';
    if (status === 'Waiting to Integrate') return 'bg-amber-500';
    if (status === 'In Process') return 'bg-blue-500';
    if (status === 'Not Started') return 'bg-zinc-500';
    if (status === 'Staging Passed' || status === 'Completed') return 'bg-emerald-500';
    return 'bg-zinc-600';
}

export function statusBadge(status: string) {
    const severity = getStatusSeverity(status);
    const classes: Record<string, string> = {
        normal: 'bg-zinc-800 text-zinc-300 border-zinc-700',
        high: 'bg-amber-950 text-amber-300 border-amber-800',
        critical: 'bg-red-950 text-red-300 border-red-800',
    };
    return (
        <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-mono font-semibold ${classes[severity]}`}>
            {isBottleneckStatus(status) && <Zap className="w-2.5 h-2.5 mr-1" />}
            {status}
        </span>
    );
}
