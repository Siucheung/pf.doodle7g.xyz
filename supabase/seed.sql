-- ============================================================
-- OpsPilot - Seed Data (Optional)
-- Run this AFTER schema.sql and rls-policies.sql
-- ============================================================

-- This file is for development/testing purposes only
-- It creates sample data to test the application

-- NOTE: You need to create a user first via the app's signup flow
-- Then you can use that user's ID below to create sample data

-- Example: After signing up a user, insert a sample organization
-- INSERT INTO public.organizations (name, slug, plan)
-- VALUES ('Acme Corp', 'acme-corp', 'free')
-- RETURNING id;

-- Example: Add the user as owner
-- INSERT INTO public.organization_members (organization_id, user_id, role, accepted_at)
-- VALUES ('<org-id>', '<user-id>', 'owner', now());

-- Example: Create a sample project
-- INSERT INTO public.projects (organization_id, name, slug, description, status)
-- VALUES ('<org-id>', 'API Service', 'api-service', 'Main API service', 'active')
-- RETURNING id;

-- Example: Create a sample deployment
-- INSERT INTO public.deployments (project_id, organization_id, status, environment, commit_sha, commit_message, branch)
-- VALUES ('<project-id>', '<org-id>', 'success', 'production', 'abc1234', 'Initial deployment', 'main')
-- RETURNING id;

-- Example: Create a sample monitor
-- INSERT INTO public.monitors (project_id, organization_id, name, url, enabled)
-- VALUES ('<project-id>', '<org-id>', 'Health Check', 'https://api.example.com/health', true)
-- RETURNING id;
