'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useData } from '../DataProvider';

const STORAGE_KEY = 'sprint_relay_archived_tasks';

export interface ArchivedTaskEntry {
    taskId: string;
    taskName: string;
    archivedAt: string;     // ISO timestamp
    archivedFrom: string;   // sprint number
    lastStatus: string;
    person: string;
}

export function useArchivedTasks() {
    const { data: sharedData, isLoaded: sharedLoaded, updateKey } = useData();
    const [archivedTasks, setArchivedTasks] = useState<ArchivedTaskEntry[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        if (!sharedLoaded) return;
        if (sharedData[STORAGE_KEY]) {
            try {
                const parsed = JSON.parse(sharedData[STORAGE_KEY]) as ArchivedTaskEntry[];
                setArchivedTasks(parsed);
            } catch (e) { }
        }
        setIsLoaded(true);
    }, [sharedLoaded, sharedData]);

    const persist = useCallback((entries: ArchivedTaskEntry[]) => {
        updateKey(STORAGE_KEY, JSON.stringify(entries));
    }, [updateKey]);

    const archiveTask = useCallback((entry: Omit<ArchivedTaskEntry, 'archivedAt'>) => {
        setArchivedTasks((prev) => {
            // Don't duplicate
            if (prev.some(e => e.taskId === entry.taskId)) return prev;
            const next = [...prev, { ...entry, archivedAt: new Date().toISOString() }];
            persist(next);
            return next;
        });
    }, [persist]);

    const unarchiveTask = useCallback((taskId: string) => {
        setArchivedTasks((prev) => {
            const next = prev.filter(e => e.taskId !== taskId);
            persist(next);
            return next;
        });
    }, [persist]);

    const isArchived = useCallback(
        (taskId: string) => archivedTasks.some(e => e.taskId === taskId),
        [archivedTasks]
    );

    const archivedIds = useMemo(() => new Set(archivedTasks.map(e => e.taskId)), [archivedTasks]);

    return { archivedTasks, archivedIds, archiveTask, unarchiveTask, isArchived, isLoaded };
}
