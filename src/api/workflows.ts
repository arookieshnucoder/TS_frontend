import { adminRequest } from './management'
import type { WorkflowRecord, WorkflowSnapshot, WorkflowVersion } from '../../../backend/src/modules/workflows/definition'
export * from '../../../backend/src/modules/workflows/definition'
import type { RuntimeSnapshot } from '../../../backend/src/modules/workflows/definition'
export type { RuntimeSnapshot }
export type WorkflowDetail = WorkflowRecord & { runtime?: RuntimeSnapshot }
export type WorkflowListItem = Omit<WorkflowRecord, 'graph'>
export type VersionSummary = Pick<WorkflowVersion, 'revision' | 'title' | 'publishedAt' | 'publishedBy'>
const path = (id: string) => `/workflows/${encodeURIComponent(id)}`
const json = (method: string, body: unknown): RequestInit => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
const payload = ({ title, description, subject, graph }: WorkflowSnapshot) => ({ title, description, subject, graph })
export const workflowsApi = {
  list: (signal?: AbortSignal) => adminRequest<WorkflowListItem[]>('/workflows', { signal }),
  get: (id: string, signal?: AbortSignal) => adminRequest<WorkflowDetail>(path(id), { signal }),
  create: (value: WorkflowSnapshot) => adminRequest<WorkflowDetail>('/workflows', json('POST', payload(value))),
  save: (value: WorkflowSnapshot) => adminRequest<WorkflowDetail>(path(value.id), json('PUT', { ...payload(value), expectedRevision: value.revision })),
  publish: (id: string, expectedRevision: number) => adminRequest<WorkflowDetail>(`${path(id)}/publish`, json('POST', { expectedRevision })),
  versions: (id: string, signal?: AbortSignal) => adminRequest<VersionSummary[]>(`${path(id)}/versions`, { signal }),
  version: (id: string, revision: number, signal?: AbortSignal) => adminRequest<WorkflowVersion>(`${path(id)}/versions/${revision}`, { signal }),
  template: (subject: string, signal?: AbortSignal) => adminRequest<WorkflowSnapshot>(`/workflows/template/${encodeURIComponent(subject)}`, { signal }),
}
