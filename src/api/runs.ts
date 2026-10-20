import { adminRequest } from './management'
import type { WorkflowSnapshot } from './workflows'

export type RunStatus = 'pending' | 'success' | 'failure' | 'cancelled' | 'timed_out' | 'interrupted'
/** 运行列表中的摘要信息，提供状态、耗时和事件数量，详情按需加载。 */
export interface RunSummary {
  id: string; sessionId: string; requestId: string; userMessageId: string; assistantMessageId?: string
  question: string; status: RunStatus; startedAt: string; finishedAt?: string; durationMs?: number; answerDurationMs?: number
  eventCount: number; droppedEvents: number
}
/** 运行追踪中的一个有序事件，记录发生时间、相对耗时和结构化字段。 */
export interface RunEvent { sequence: number; name: string; timestamp: string; elapsedMs: number; fields: Record<string, unknown> }
/** 一次回答的完整运行记录，关联会话、请求、消息及按顺序发生的事件。 */
export interface RunTrace extends Omit<RunSummary, 'eventCount'> { events: RunEvent[]; workflow?: WorkflowSnapshot & { runtime: Record<string, unknown> } }
export const runsApi = {
  list: (sessionId: string, before?: string, signal?: AbortSignal) => adminRequest<{ runs: RunSummary[]; nextCursor?: string }>(
    `/observability/sessions/${encodeURIComponent(sessionId)}/runs${before ? `?before=${encodeURIComponent(before)}` : ''}`, { signal }),
  get: (sessionId: string, runId: string, signal?: AbortSignal) => adminRequest<RunTrace>(
    `/observability/sessions/${encodeURIComponent(sessionId)}/runs/${encodeURIComponent(runId)}`, { signal }),
}
