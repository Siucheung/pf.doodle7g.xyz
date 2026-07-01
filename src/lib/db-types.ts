export interface Organization {
  id: string
  name: string
  slug: string
  created_at: string
}

export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
}

export interface Project {
  id: string
  name: string
  slug: string
  description: string | null
  status: string
  organization_id: string
  repository_url: string | null
  created_at: string
  updated_at: string
  project?: { name: string }
}

export interface Deployment {
  id: string
  status: string
  environment: string
  commit_message: string | null
  commit_sha: string | null
  branch: string | null
  duration_ms: number | null
  created_at: string
  project?: { name: string; slug: string }
  actor?: { full_name: string }
}

export interface Monitor {
  id: string
  name: string
  url: string
  method: string
  expected_status: number
  interval_seconds: number
  enabled: boolean
  project_id: string
  created_at: string
  project?: { name: string; slug: string }
}

export interface LogEntry {
  id: string
  level: string
  message: string
  source: string | null
  created_at: string
  project?: { name: string }
}

export interface Incident {
  id: string
  title: string
  description: string | null
  severity: string
  status: string
  project_id: string
  organization_id: string
  monitor_id: string | null
  created_at: string
  project?: { name: string; slug: string }
  monitor?: { name: string }
}

export interface IncidentEvent {
  id: string
  incident_id: string
  event_type: string
  old_value: string | null
  new_value: string | null
  created_at: string
  actor?: { full_name: string }
}

export interface OrganizationMember {
  id: string
  organization_id: string
  user_id: string
  role: string
  accepted_at: string | null
  invited_at: string
  profile?: Profile
}

export interface CiPipeline {
  id: string
  project_id: string
  organization_id: string
  pipeline_number: number
  status: string
  event: string
  commit_sha: string | null
  commit_message: string | null
  branch: string | null
  author: string | null
  duration_ms: number | null
  link_url: string | null
  steps: CiPipelineStep[]
  woodpecker_pipeline_id: number | null
  error_message: string | null
  started_at: string | null
  finished_at: string | null
  created_at: string
  updated_at: string
  project?: { name: string; slug: string }
}

export interface CiPipelineStep {
  name: string
  status: string
  exit_code: number | null
  duration_ms: number | null
}

export interface ForgeRepo {
  id: string
  project_id: string
  organization_id: string
  forge_type: string
  forge_repo_id: string
  forge_repo_full_name: string
  clone_url: string
  woodpecker_repo_id: number | null
  created_at: string
  updated_at: string
}

export interface InfisicalCredential {
  id: string
  project_id: string
  organization_id: string
  infisical_project_id: string
  infisical_environment: string
  machine_identity_client_id: string
  machine_identity_client_secret_encrypted: string
  encryption_key_id: string
  infisical_url: string
  created_at: string
  updated_at: string
}
