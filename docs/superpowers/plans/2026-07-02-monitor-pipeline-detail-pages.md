# Monitor Detail & Pipeline Detail Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add standalone monitor detail page (with check history, edit/delete) and standalone pipeline detail page (with workflow steps, logs, cancel/restart).

**Architecture:** Server component fetches data via Supabase/Woodpecker; client components handle forms, dialogs, and action buttons. Follows existing patterns in incidents detail page and monitor create API.

**Tech Stack:** Next.js 16 App Router, Supabase, Woodpecker CI, shadcn/ui, next-intl

## Global Constraints

- Next.js 16: `params` is always `Promise<T>` — must `await`
- All user-visible strings through `useTranslations`/`getTranslations` with `{default: '...'}` fallbacks
- API routes follow existing auth pattern: `createClient()` → `getUser()` → org membership check via `organization_members`
- Supabase `never[]` type errors are known and ignored (`ignoreBuildErrors: true`)
- shadcn/ui nova Select: `onValueChange` passes `string | null`, wrap setter with `(v) => v && setState(v)`

---

## File Structure

### Monitor Detail

| File | Action | Responsibility |
|---|---|---|
| `src/app/api/monitors/[monitorId]/route.ts` | Create | GET single monitor, PATCH update, DELETE |
| `src/components/dashboard/edit-monitor-dialog.tsx` | Create | Client dialog for editing monitor fields |
| `src/app/(dashboard)/[org]/monitors/[monitorId]/page.tsx` | Create | Server component detail page |
| `src/messages/en.json` | Modify | Add monitor detail translations |
| `src/messages/zh-CN.json` | Modify | Add monitor detail translations |
| `src/app/(dashboard)/[org]/monitors/page.tsx` | Modify | Make monitor cards clickable → link to detail |

### Pipeline Detail

| File | Action | Responsibility |
|---|---|---|
| `src/app/(dashboard)/[org]/projects/[projectId]/ci/pipelines/[number]/page.tsx` | Create | Server component pipeline detail page |
| `src/messages/en.json` | Modify | Add pipeline detail translations |
| `src/messages/zh-CN.json` | Modify | Add pipeline detail translations |

---

## Task List

### Task 1: API — GET/PATCH/DELETE /api/monitors/[monitorId]

Create `src/app/api/monitors/[monitorId]/route.ts` with three handlers:

- **GET**: Fetch single monitor with joined project, verify org membership, return monitor or 404/403
- **PATCH**: Verify owner/admin role, update allowed fields (name, url, method, expected_status, interval_seconds, enabled, project_id), return updated monitor
- **DELETE**: Verify owner/admin role, delete monitor, return { success: true }

All handlers follow the exact auth and error pattern from `src/app/api/incidents/[incidentId]/route.ts`.

**Verification:** `npx tsc --noEmit` — expect only known Supabase `never[]` errors.

### Task 2: Translation keys — monitor detail

Add to `monitors` namespace in both `en.json` and `zh-CN.json`:
- `editMonitor`, `deleteMonitor`, `deleteConfirm`, `recentChecks`, `relatedIncidents`, `noChecks`, `statusCode`, `errorMessage`

### Task 3: Edit Monitor Dialog component

Create `src/components/dashboard/edit-monitor-dialog.tsx`:
- Client component with same form fields as `add-monitor-dialog.tsx` (name, url, method, expected_status, interval_seconds, enabled checkbox)
- Pre-populated with existing monitor values
- `PATCH /api/monitors/[monitorId]` on save → `router.refresh()`
- Delete button within AlertDialog confirmation → `DELETE /api/monitors/[monitorId]` → `router.push('.')`
- Reuses existing `monitors.*` translation keys + `common.save`/`common.cancel`/`common.delete`

### Task 4: Monitor Detail page (server component)

Create `src/app/(dashboard)/[org]/monitors/[monitorId]/page.tsx`:
- Fetch monitor from Supabase with project join (same pattern as monitors list page)
- Fetch checks from `/api/monitors/[monitorId]/checks?limit=50`
- Fetch related incidents: `supabase.from('incidents').select(...).eq('monitor_id', monitorId).limit(5)`
- Layout: back link → info header card → MonitorSparkline → recent checks table → related incidents
- Add `<EditMonitorDialog monitor={...} />` next to back link

### Task 5: Wire monitors list → detail

In `src/app/(dashboard)/[org]/monitors/page.tsx`, wrap each monitor card in `<Link href={...}>` pointing to `[org]/monitors/[monitor.id]`.

### Task 6: Translation keys — pipeline detail

Add to pipeline namespace in both locales:
- `cancelPipeline`, `restartPipeline`, `workflow`, `stepName`, `author`
- Reuse from `deployments` where possible: `duration`, `commit`, `branch`, `by`

### Task 7: Pipeline Detail page (server component)

Create `src/app/(dashboard)/[org]/projects/[projectId]/ci/pipelines/[number]/page.tsx`:
- Fetch org from slug to verify access
- Call `GET /api/projects/[projectId]/ci/pipelines/[number]` for pipeline + workflow steps
- Layout: back link → pipeline info header (number, status badge, branch, commit, author, duration) → workflow cards with step rows and View Logs buttons → Cancel/Restart action buttons (shown conditionally based on pipeline status)
- Steps link to existing `PipelineStepLogs` dialog
- Reuses `status` translation namespace for badges

## Implementation Order

Phase 1 (Monitor Detail) — Tasks 1, 2, 3, 4, 5 (sequential dependencies)
Phase 2 (Pipeline Detail) — Tasks 6, 7 (sequential, independent of Phase 1)
