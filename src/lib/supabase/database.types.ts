export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      chunks: {
        Row: {
          end_ts: string | null
          id: string
          idx: number
          session_id: string
          start_ts: string | null
          text: string
          tool_calls: Json | null
        }
        Insert: {
          end_ts?: string | null
          id?: string
          idx: number
          session_id: string
          start_ts?: string | null
          text: string
          tool_calls?: Json | null
        }
        Update: {
          end_ts?: string | null
          id?: string
          idx?: number
          session_id?: string
          start_ts?: string | null
          text?: string
          tool_calls?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "chunks_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      commits: {
        Row: {
          authored_at: string | null
          files: Json | null
          id: string
          message: string
          project_id: string
          sha: string
        }
        Insert: {
          authored_at?: string | null
          files?: Json | null
          id?: string
          message: string
          project_id: string
          sha: string
        }
        Update: {
          authored_at?: string | null
          files?: Json | null
          id?: string
          message?: string
          project_id?: string
          sha?: string
        }
        Relationships: [
          {
            foreignKeyName: "commits_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      findings: {
        Row: {
          chunk_id: string
          confidence: number
          created_at: string
          id: string
          quote: Json
          session_id: string
          stage: string
          summary: string
        }
        Insert: {
          chunk_id: string
          confidence: number
          created_at?: string
          id?: string
          quote: Json
          session_id: string
          stage: string
          summary: string
        }
        Update: {
          chunk_id?: string
          confidence?: number
          created_at?: string
          id?: string
          quote?: Json
          session_id?: string
          stage?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "findings_chunk_id_fkey"
            columns: ["chunk_id"]
            isOneToOne: false
            referencedRelation: "chunks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "findings_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      heartbeat: {
        Row: {
          created_at: string
          id: number
          note: string | null
        }
        Insert: {
          created_at?: string
          id?: never
          note?: string | null
        }
        Update: {
          created_at?: string
          id?: never
          note?: string | null
        }
        Relationships: []
      }
      jobs: {
        Row: {
          created_at: string
          error: string | null
          id: string
          kind: string
          next_idx: number
          progress: number
          session_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          kind: string
          next_idx?: number
          progress?: number
          session_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          kind?: string
          next_idx?: number
          progress?: number
          session_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          commit_id: string
          finding_id: string
          method: string
          score: number | null
        }
        Insert: {
          commit_id: string
          finding_id: string
          method: string
          score?: number | null
        }
        Update: {
          commit_id?: string
          finding_id?: string
          method?: string
          score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_commit_id_fkey"
            columns: ["commit_id"]
            isOneToOne: false
            referencedRelation: "commits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_finding_id_fkey"
            columns: ["finding_id"]
            isOneToOne: false
            referencedRelation: "findings"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolios: {
        Row: {
          created_at: string
          id: string
          published_at: string | null
          session_id: string
          slug: string
          title: string
          view: Json
        }
        Insert: {
          created_at?: string
          id?: string
          published_at?: string | null
          session_id: string
          slug: string
          title: string
          view: Json
        }
        Update: {
          created_at?: string
          id?: string
          published_at?: string | null
          session_id?: string
          slug?: string
          title?: string
          view?: Json
        }
        Relationships: [
          {
            foreignKeyName: "portfolios_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string | null
          repo_url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id?: string | null
          repo_url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string | null
          repo_url?: string | null
        }
        Relationships: []
      }
      sessions: {
        Row: {
          created_at: string
          fidelity: string
          id: string
          project_id: string
          source_tool: string
          stats: Json | null
          status: string
          storage_path: string
        }
        Insert: {
          created_at?: string
          fidelity: string
          id?: string
          project_id: string
          source_tool: string
          stats?: Json | null
          status?: string
          storage_path: string
        }
        Update: {
          created_at?: string
          fidelity?: string
          id?: string
          project_id?: string
          source_tool?: string
          stats?: Json | null
          status?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
