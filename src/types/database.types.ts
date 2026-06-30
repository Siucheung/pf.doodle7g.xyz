// Placeholder types - replace with generated types from Supabase
// Run: npx supabase gen types typescript --project-id <project-id> > src/types/database.types.ts
export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]
export type Database = Record<string, Json>

