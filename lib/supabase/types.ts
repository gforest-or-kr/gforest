export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      attachments: {
        Row: {
          byte_size: number
          created_at: string
          file_name: string
          id: string
          legacy_file_srl: number | null
          mime_type: string
          post_id: string
          storage_path: string
          uploader_id: string
        }
        Insert: {
          byte_size: number
          created_at?: string
          file_name: string
          id?: string
          legacy_file_srl?: number | null
          mime_type: string
          post_id: string
          storage_path: string
          uploader_id: string
        }
        Update: {
          byte_size?: number
          created_at?: string
          file_name?: string
          id?: string
          legacy_file_srl?: number | null
          mime_type?: string
          post_id?: string
          storage_path?: string
          uploader_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_uploader_id_fkey"
            columns: ["uploader_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      boards: {
        Row: {
          board_type: Database["public"]["Enums"]["board_type"]
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          legacy_mid: string | null
          menu_group: string
          name: string
          read_roles: Database["public"]["Enums"]["app_role"][] | null
          slug: string
          sort_order: number
          write_roles: Database["public"]["Enums"]["app_role"][]
        }
        Insert: {
          board_type?: Database["public"]["Enums"]["board_type"]
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          legacy_mid?: string | null
          menu_group: string
          name: string
          read_roles?: Database["public"]["Enums"]["app_role"][] | null
          slug: string
          sort_order?: number
          write_roles?: Database["public"]["Enums"]["app_role"][]
        }
        Update: {
          board_type?: Database["public"]["Enums"]["board_type"]
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          legacy_mid?: string | null
          menu_group?: string
          name?: string
          read_roles?: Database["public"]["Enums"]["app_role"][] | null
          slug?: string
          sort_order?: number
          write_roles?: Database["public"]["Enums"]["app_role"][]
        }
        Relationships: []
      }
      comments: {
        Row: {
          author_id: string
          content: string
          created_at: string
          deleted_at: string | null
          id: string
          legacy_comment_srl: number | null
          parent_id: string | null
          post_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          legacy_comment_srl?: number | null
          parent_id?: string | null
          post_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          legacy_comment_srl?: number | null
          parent_id?: string | null
          post_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      popups: {
        Row: {
          body: string
          created_at: string
          dismiss_days: number
          ends_at: string
          id: string
          image_path: string | null
          is_active: boolean
          link_url: string | null
          sort_order: number
          starts_at: string
          title: string
        }
        Insert: {
          body?: string
          created_at?: string
          dismiss_days?: number
          ends_at: string
          id?: string
          image_path?: string | null
          is_active?: boolean
          link_url?: string | null
          sort_order?: number
          starts_at?: string
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          dismiss_days?: number
          ends_at?: string
          id?: string
          image_path?: string | null
          is_active?: boolean
          link_url?: string | null
          sort_order?: number
          starts_at?: string
          title?: string
        }
        Relationships: []
      }
      posts: {
        Row: {
          author_id: string
          board_id: string
          content: string
          created_at: string
          deleted_at: string | null
          event_date: string | null
          event_end: string | null
          event_start: string | null
          id: string
          is_notice: boolean
          legacy_document_srl: number | null
          space_id: string | null
          title: string
          updated_at: string
          view_count: number
        }
        Insert: {
          author_id: string
          board_id: string
          content?: string
          created_at?: string
          deleted_at?: string | null
          event_date?: string | null
          event_end?: string | null
          event_start?: string | null
          id?: string
          is_notice?: boolean
          legacy_document_srl?: number | null
          space_id?: string | null
          title: string
          updated_at?: string
          view_count?: number
        }
        Update: {
          author_id?: string
          board_id?: string
          content?: string
          created_at?: string
          deleted_at?: string | null
          event_date?: string | null
          event_end?: string | null
          event_start?: string | null
          id?: string
          is_notice?: boolean
          legacy_document_srl?: number | null
          space_id?: string | null
          title?: string
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          bio: string | null
          created_at: string
          id: string
          legacy_member_srl: number | null
          name: string
          nickname: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          avatar_path?: string | null
          bio?: string | null
          created_at?: string
          id: string
          legacy_member_srl?: number | null
          name: string
          nickname: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          avatar_path?: string | null
          bio?: string | null
          created_at?: string
          id?: string
          legacy_member_srl?: number | null
          name?: string
          nickname?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      role_audit: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: number
          new_role: Database["public"]["Enums"]["app_role"]
          old_role: Database["public"]["Enums"]["app_role"] | null
          user_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: never
          new_role: Database["public"]["Enums"]["app_role"]
          old_role?: Database["public"]["Enums"]["app_role"] | null
          user_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: never
          new_role?: Database["public"]["Enums"]["app_role"]
          old_role?: Database["public"]["Enums"]["app_role"] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_audit_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_audit_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      slides: {
        Row: {
          created_at: string
          id: string
          image_desktop_path: string
          image_mobile_path: string
          is_active: boolean
          link_url: string | null
          sort_order: number
          subtitle: string | null
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_desktop_path: string
          image_mobile_path: string
          is_active?: boolean
          link_url?: string | null
          sort_order?: number
          subtitle?: string | null
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          image_desktop_path?: string
          image_mobile_path?: string
          is_active?: boolean
          link_url?: string | null
          sort_order?: number
          subtitle?: string | null
          title?: string
        }
        Relationships: []
      }
      spaces: {
        Row: {
          color: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          color?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          color?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      static_pages: {
        Row: {
          content: string
          id: string
          menu_group: string
          slug: string
          sort_order: number
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          content?: string
          id?: string
          menu_group?: string
          slug: string
          sort_order?: number
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          content?: string
          id?: string
          menu_group?: string
          slug?: string
          sort_order?: number
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "static_pages_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_read_board: { Args: { b_id: string }; Returns: boolean }
      can_write_board: { Args: { b_id: string }; Returns: boolean }
      current_app_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      increment_view_count: { Args: { p_post_id: string }; Returns: undefined }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role:
        | "pending"
        | "member"
        | "operator"
        | "teacher"
        | "student"
        | "admin"
      board_type: "list" | "gallery" | "calendar" | "reservation"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "pending",
        "member",
        "operator",
        "teacher",
        "student",
        "admin",
      ],
      board_type: ["list", "gallery", "calendar", "reservation"],
    },
  },
} as const

