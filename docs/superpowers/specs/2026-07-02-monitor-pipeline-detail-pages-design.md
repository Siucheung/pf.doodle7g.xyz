# Monitor Detail & Pipeline Detail Pages

## Overview

Add two missing detail page views to OpsPilot: a standalone monitor detail page with check history and an edit dialog, and a standalone pipeline detail page with workflow step visualization, log access, and action controls.

Both follow the established codebase pattern: **server component fetches data, client component handles interactivity**.

---

## 1. Monitor Detail Page

### Route
`[org]/monitors/[monitorId]/page.tsx` — new server component page

### API Changes

**New: `GET /api/monitors/[monitorId]`**
- Returns single monitor with joined `project:projects(name, slug)`
- Requires login + org membership via monitor's organization_id
- Response shape: `{ id, name, url, method, expected_status, interval_seconds, enabled, project_id, created_at, project }`

**New: `PATCH /api/monitors/[monitorId]`**
- Updates monitor fields: name, url, method, expected_status, interval_seconds, enabled
- Requires login + owner/admin role in the org
- Body: partial monitor fields

**New: `DELETE /api/monitors/[monitorId]`**
- Deletes monitor + its checks (cascade)
- Requires owner/admin role

### Page Layout (Server Component)

```
┌─ Back to Monitors ─────────────────────────────── [Edit] [Delete] ─┐
│                                                                      │
│  Monitor Name                              Status Badge           │
│  URL: https://example.com/health                                    │
│  Method: GET · Expected: 200 · Interval: 30s · Project: my-project │
│  Created: 2 days ago                                                │
│                                                                      │
│  ┌─ Response Time (24h) ──────────────────────────────────────────┐ │
│  │  [AreaChart from monitor-sparkline, expanded to full width]   │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌─ Recent Checks ─────────────────────────────────────────────────┐ │
│  │  Time           │ Status  │ Code │ Response    │ Error          │ │
│  │  ─────────────────────────────────────────────────────────────  │ │
│  │  10:32:15       │ ● up    │ 200  │ 120ms       │ —              │ │
│  │  10:31:45       │ ● up    │ 200  │ 95ms        │ —              │ │
│  │  10:30:12       │ ● down  │ 502  │ —           │ Bad Gateway    │ │
│  │  ...                                                            │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌─ Related Incidents ─────────────────────────────────────────────┐ │
│  │  (list of incidents where incident.monitor_id matches)         │ │
│  └────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

### Components

**Edit Monitor Dialog** (client component, `edit-monitor-dialog.tsx`)
- Reuses the same form fields as `add-monitor-dialog.tsx`
- Pre-populated with existing values
- `PATCH /api/monitors/[monitorId]` on save, then `router.refresh()`

**Monitor Checks Table** (inline in page or client component)
- Fetches `/api/monitors/[monitorId]/checks?limit=50`
- Responsive table with time, status dot, status code, response time, error message
- Empty state: "No checks recorded yet"

**Related Incidents Section** (server-side query)
- `supabase.from('incidents').select(...).eq('monitor_id', monitorId).order('created_at', { ascending: false }).limit(5)`
- Each incident card links to `[org]/incidents/[incidentId]`

### Translations

Add to both `en.json` and `zh-CN.json` `monitors` namespace:
- `editMonitor` / `编辑监控`
- `deleteMonitor` / `删除监控`
- `deleteConfirm` / `确定删除此监控？`
- `recentChecks` / `最近检查`
- `relatedIncidents` / `关联工单`
- `noChecks` / `暂无检查记录`
- `responseTime` (already exists)
- `statusCode` / `状态码`
- `errorMessage` / `错误信息`

### Data Flow

```
GET request → [org]/monitors/[monitorId] (server)
  ├── GET /api/monitors/[monitorId] → monitor object
  ├── supabase query → recent checks (limited to 50)
  └── supabase query → related incidents (limited to 5)
  ↓
  Render page:
  ├── Monitor info card (static)
  ├── MonitorSparkline (client, fetches its own /checks data)
  ├── ChecksTable (server data passed as props)
  ├── RelatedIncidents (server data passed as props)
  └── EditMonitorDialog (client, PATCH on save)
```

---

## 2. Pipeline Detail Page

### Route
`[org]/projects/[projectId]/ci/pipelines/[number]/page.tsx` — new server component page

### API Changes

None. Existing APIs are sufficient:
- `GET /api/projects/[projectId]/ci/pipelines/[number]` — pipeline detail with workflows/steps
- `POST /api/projects/[projectId]/ci/pipelines/[number]/cancel` — cancel
- `POST /api/projects/[projectId]/ci/pipelines/[number]` (with action=restart) — restart
- `POST /api/ci/logs` — step logs

### Page Layout (Server Component)

```
┌─ Back to Project ───────────────────────────────────────────────────┐
│                                                                      │
│  Pipeline #42                              Status Badge              │
│  Branch: main · Commit: a1b2c3d4 · Author: user                     │
│  Duration: 2m30s · Created: 2 hours ago                             │
│                                                                      │
│  [Cancel] [Restart]   (actions, shown based on pipeline status)      │
│                                                                      │
│  ┌─ Workflow: build ───────────────────────────────────────────────┐ │
│  │  ✅ lint     1m20s    [View Logs]                               │ │
│  │  ✅ test     0m45s    [View Logs]                               │ │
│  │  ✅ build    0m25s    [View Logs]                               │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌─ Workflow: deploy ──────────────────────────────────────────────┐ │
│  │  ⏳ staging  0m10s    [View Logs]                               │ │
│  └────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

### Components

**Pipeline Workflow Section** (server-rendered, with client log trigger)
- Groups steps by workflow as visual cards
- Each step row: status icon + name + duration + "View Logs" button
- "View Logs" opens the existing `PipelineStepLogs` dialog

**Action Buttons**
- Cancel: shown when pipeline is running/pending
- Restart: shown when pipeline is finished/failed/cancelled
- Both are client buttons, call respective APIs, then `router.refresh()`

### Translations

Add to `pipeline` namespace (or reuse existing pipeline translations):
- `cancelPipeline` / `取消流水线`
- `restartPipeline` / `重新运行`
- `workflow` / `工作流`
- `step` / `步骤`
- `duration` (reuse from deployments)
- `commit` (reuse from deployments)
- `author` / `作者`

### Data Flow

```
GET request → [org]/projects/[projectId]/ci/pipelines/[number] (server)
  └── GET /api/projects/[projectId]/ci/pipelines/[number] → pipeline + workflows + steps
  ↓
  Render page:
  ├── Pipeline info header (static)
  ├── ActionButtons (client, cancel/restart)
  ├── Workflow cards × N (static)
  │   └── Step rows → PipelineStepLogs (client dialog, opens on click)
  └── Error/loading states
```

---

## Implementation Order (within each page)

### Monitor Detail
1. `GET /api/monitors/[monitorId]` route
2. `PATCH /api/monitors/[monitorId]` route
3. `DELETE /api/monitors/[monitorId]` route
4. Translation keys for monitor detail
5. Edit Monitor dialog component
6. Monitor detail page (server component)
7. Wire "Edit" + "Delete" buttons in list page cards → link to detail page
8. Verify page renders with real data

### Pipeline Detail
1. Translation keys for pipeline detail
2. Pipeline detail page (server component, reuses existing APIs)
3. Verify page renders pipeline data + workflow steps
4. Verify cancel/restart buttons work
5. Verify View Logs triggers PipelineStepLogs dialog

---

## Patterns & Conventions Used

- **Server/Client split**: Server component fetches and renders initial data; client components handle form submissions, dialog state, and real-time updates
- **API route auth**: All new routes follow existing pattern — `createClient()`, `getUser()`, org membership check via `organization_members`
- **Translation**: All user-visible strings through `useTranslations`/`getTranslations`, with `{default: '...'}` fallbacks
- **Responsive**: Layout uses standard Tailwind grid; checks table collapses to card view on mobile
- **Error handling**: `try/catch` in page, returns error state or redirect to 404
