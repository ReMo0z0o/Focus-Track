// Database type definitions matching supabase/migrations.
// Regenerate with `supabase gen types typescript` when the schema changes.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          display_name: string | null
          idle_threshold_seconds: number
          sound_enabled: boolean
          theme: string
          avatar: string
          milestones: Json
          created_at: string
        }
        Insert: {
          id: string
          display_name?: string | null
          idle_threshold_seconds?: number
          sound_enabled?: boolean
          theme?: string
          avatar?: string
          milestones?: Json
          created_at?: string
        }
        Update: {
          id?: string
          display_name?: string | null
          idle_threshold_seconds?: number
          sound_enabled?: boolean
          theme?: string
          avatar?: string
          milestones?: Json
          created_at?: string
        }
        Relationships: []
      }
      focus_sessions: {
        Row: {
          id: string
          user_id: string
          started_at: string
          ended_at: string | null
          focus_seconds: number
          idle_seconds: number
          resumes_count: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          started_at?: string
          ended_at?: string | null
          focus_seconds?: number
          idle_seconds?: number
          resumes_count?: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          started_at?: string
          ended_at?: string | null
          focus_seconds?: number
          idle_seconds?: number
          resumes_count?: number
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
