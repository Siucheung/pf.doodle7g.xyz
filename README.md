
# OpsPilot

**OpsPilot** is a full‑stack software operations platform that brings together project management, CI/CD pipelines, monitoring, logging, secrets, incidents, alerts, and team collaboration — all under one roof with multi‑tenant organization support.

Built as a modern alternative to scattered ops tools, it demonstrates end‑to‑end full‑stack engineering with a focus on real‑world DevOps workflows.

## Features

| Module | Description | Integration |
|--------|-------------|-------------|
| **Organizations** | Multi‑tenant workspace with role‑based access (owner / admin / member / viewer) | Supabase RLS |
| **Projects** | Manage software projects with metadata and settings | Supabase |
| **CI/CD Pipelines** | View, run, and cancel pipelines per project | Woodpecker CI + Gitea |
| **Deployments** | Track deployment history and status | Vercel webhook, Render |
| **Monitoring** | Service health dashboard with uptime status | Gatus |
| **Logs** | Centralized log viewer | Supabase |
| **Secrets** | Store and manage environment secrets across projects | Infisical (encrypted at rest) |
| **Audit Log** | Immutable audit trail for all operations | Supabase with audit trigger |
| **Incidents** | Issue tracking and incident management | Supabase |
| **Alerts** | Real‑time alert feed from monitoring systems | Alertmanager webhook |
| **Notifications** | Multi‑channel notification routing | Apprise (email, Slack, Telegram, etc.) |
| **Team** | Invite members and manage roles per organization | Supabase |
| **Backup** | Automated database backup scheduling | WAL‑G |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | [Next.js 16](https://nextjs.org/) (App Router, Turbopack, React 19) |
| **Language** | TypeScript |
| **Database** | [Supabase](https://supabase.com/) (PostgreSQL + RLS + Auth) |
| **UI** | [shadcn/ui](https://ui.shadcn.com/) nova + [@base-ui/react](https://base-ui.com/) |
| **Styling** | Tailwind CSS v4 |
| **i18n** | next-intl (中文 / English) |
| **Auth** | Supabase Auth (email/password + GitHub OAuth) |
| **Secrets** | Infisical (self‑hosted, AES‑256‑GCM encrypted at rest) |
| **CI** | Woodpecker CI |
| **Code Hosting** | Gitea |
| **Notifications** | Apprise |
| **Monitoring** | Gatus, Alertmanager |
| **Charts** | Recharts |
| **Animation** | tw-animate-css |
| **Deployment** | Vercel / Render |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Next.js 16 App                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ Dashboard │ │ Projects │ │ CI/CD    │ │ Settings │   │
│  │ Overview  │ │ +Secrets │ │ +Deploy  │ │ +Team    │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ Monitors  │ │ Logs     │ │Alerts    │ │Incidents │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
├─────────────────────────────────────────────────────────┤
│  API Routes (webhooks, data APIs, auth callbacks)       │
├─────────────────────────────────────────────────────────┤
│  Supabase Client (Auth + PostgreSQL + RLS)              │
└─────────────────────────────────────────────────────────┘
         │              │              │
    ┌────┴────┐   ┌────┴────┐   ┌────┴────┐
    │Supabase │   │Infisical│   │External │
    │PostgreSQL│  │Secrets  │   │Services │
    │+ Auth   │   │Manager  │   │(CI/Git/ │
    │+ RLS    │   │         │   │Monitoring│
    └─────────┘   └─────────┘   └─────────┘
```

## Getting Started

### Prerequisites

- Node.js ≥ 20
- pnpm / npm / yarn
- Supabase project (cloud or local)
- Docker (optional, for self‑hosted services)

### Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

Key variables:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous API key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service‑role key (server‑side only) |

### Database Setup

Run the SQL files in order via Supabase SQL Editor:

1. `supabase/schema.sql` — tables, indexes, triggers, functions
2. `supabase/migrations/*.sql` — feature migrations
3. `supabase/rls-policies.sql` — row‑level security policies

All SQL is idempotent — safe to re‑run.

### Install & Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Demo Account

The login page is pre‑filled with a demo account — just click **Login** to explore:

- **Email:** `seancheung.letter@qq.com`
- **Password:** `RZnAO%7hz&a3v6`

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── (auth)/             # Login, signup, password reset
│   ├── (dashboard)/        # Dashboard‑layout routes (org‑scoped)
│   ├── dashboard/          # Organization selector overview
│   ├── api/                # API route handlers & webhooks
│   └── auth/               # Auth callback routes
├── components/
│   ├── auth/               # Auth forms (login/signup)
│   ├── dashboard/          # Sidebar, header
│   ├── settings/           # Settings dialogs
│   └── ui/                 # shadcn/ui primitives
├── lib/
│   ├── services/           # Business logic services
│   ├── supabase/           # Supabase client instances
│   ├── constants.ts        # Sidebar nav items
│   ├── encryption.ts       # AES‑256‑GCM encryption
│   ├── infisical.ts        # Infisical API client
│   ├── woodpecker.ts       # Woodpecker CI client
│   ├── gitea.ts            # Gitea API client
│   ├── apprise.ts          # Apprise notification client
│   └── alertmanager.ts     # Alertmanager webhook parser
├── messages/               # i18n translations (zh‑CN / en)
└── types/                  # Shared TypeScript types

supabase/
├── schema.sql              # Full database schema
├── migrations/*.sql        # Feature migrations
└── rls-policies.sql        # Row‑level security policies
```

## Key Integrations

### CI/CD Pipeline — Woodpecker + Gitea

OpsPilot manages Git repositories via **Gitea** and CI pipelines via **Woodpecker**. The platform creates OAuth apps automatically on first setup, allowing users to trigger and monitor builds without leaving the dashboard.

### Secrets Management — Infisical

Secrets are stored in a self‑hosted **Infisical** instance. OpsPilot stores Infisical service credentials encrypted with **AES‑256‑GCM** and automatically synchronizes environment variables per project.

### Unified Notifications — Apprise

All notifications — pipeline status, alerts, deployment events — are routed through **Apprise**, supporting dozens of channels (email, Slack, Discord, Telegram, Pushover, etc.).

### Monitoring — Gatus + Alertmanager

Service health is tracked via **Gatus**. Alerts from **Prometheus Alertmanager** are ingested via webhook and displayed in the alerts feed.

### Webhook‑Driven Deployments

OpsPilot receives deployment webhooks from **Vercel** and **Render**, automatically updating project deployment status and triggering notifications.

## Database

PostgreSQL schema with 14 tables, row‑level security, audit triggers, and full idempotent migrations:

- **Organizations** — multi‑tenant workspace isolation
- **Projects** — per‑organization project management
- **Secrets / Infisical Credentials** — encrypted credential storage
- **Incidents** — issue tracking with status workflow
- **Audit Log** — immutable change history via trigger function
- **Alertmanager Alerts** — ingested alert feed
- **Notification Channels** — per‑organization notification routing

## Scripts

```bash
npm run dev       # Development server (Turbopack)
npm run build     # Production build
npm run start     # Production server
npm run lint      # ESLint
```

## Deployment

OpsPilot is designed to deploy on **Vercel** or **Render**. Database migrations must be applied before first deployment.

### Vercel

```bash
npm run build
vercel deploy
```

The platform also monitors its own deployments via Vercel webhook (self‑bootstrapping ops).

## License

MIT

---

*Built with Next.js 16, Supabase, and shadcn/ui.*
