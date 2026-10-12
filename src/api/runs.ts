import { adminRequest } from './management'

export type RunStatus = 'pending' | 'success' | 'failure' | 'cancelled' | 'timed_out' | 'interrupted'
export interface RunSummary {
  id: string; sessionId: string; requestId: string; userMessageId: string; assistantMessageId?: string
  question: string; status: RunStatus; startedAt: string; finishedAt?: string; durationMs?: number
  eventCount: number; droppedEvents: number
}
export interface RunEvent { sequence: number; name: string; timestamp: string; elapsedMs: number; fields: Record<string, unknown> }
export interface RunTrace extends Omit<RunSummary, 'eventCount'> { events: RunEvent[] }
export const runsApi = {
  list: (sessionId: string, before?: string, signal?: AbortSignal) => adminRequest<{ runs: RunSummary[]; nextCursor?: string }>(
    `/observability/sessions/${encodeURIComponent(sessionId)}/runs${before ? `?before=${encodeURIComponent(before)}` : ''}`, { signal }),
  get: (sessionId: string, runId: string, signal?: AbortSignal) => adminRequest<RunTrace>(
    `/observability/sessions/${encodeURIComponent(sessionId)}/runs/${encodeURIComponent(runId)}`, { signal }),
}
