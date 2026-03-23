export type SyncTaskStatus = 'pending' | 'sending' | 'success' | 'failed';
export type VerifyStatus = 'idle' | 'verifying' | 'done';

export interface SyncTaskResult {
    taskId: string;
    taskName: string;
    status: SyncTaskStatus;
    error?: string;
}

export interface VerificationResult {
    taskId: string;
    taskName: string;
    matched: boolean;
    detail: string;
}

export interface SyncProgress {
    total: number;
    completed: number;
    currentTaskId: string | null;
    results: SyncTaskResult[];
    phase: 'sending' | 'verifying' | 'done';
    verifyStatus: VerifyStatus;
    verificationResults: VerificationResult[];
}
