
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "ai_usage_logs": {
                  Row: {
                    "created_at": string,"error_code": string | null,"id": string,"input_tokens": number,"latency_ms": number | null,"model": string,"output_tokens": number,"provider": string,"status": string,"task": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"error_code"?: string | null,"id"?: string,"input_tokens"?: number,"latency_ms"?: number | null,"model": string,"output_tokens"?: number,"provider": string,"status": string,"task": string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"error_code"?: string | null,"id"?: string,"input_tokens"?: number,"latency_ms"?: number | null,"model"?: string,"output_tokens"?: number,"provider"?: string,"status"?: string,"task"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"body_measurements": {
                  Row: {
                    "created_at": string,"id": string,"measured_on": string,"note": string | null,"user_id": string,"waist_cm": number | null,"weight_kg": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"measured_on"?: string,"note"?: string | null,"user_id"?: string,"waist_cm"?: number | null,"weight_kg"?: number | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"measured_on"?: string,"note"?: string | null,"user_id"?: string,"waist_cm"?: number | null,"weight_kg"?: number | null
                  }
                  Relationships: [
                    
                  ]
                },"coach_conversations": {
                  Row: {
                    "created_at": string,"id": string,"title": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"title"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"title"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"coach_messages": {
                  Row: {
                    "content": string,"conversation_id": string,"created_at": string,"id": string,"metadata": NonNullable<Json>,"role": Database["public"]['Enums']["message_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "content": string,"conversation_id": string,"created_at"?: string,"id"?: string,"metadata"?: NonNullable<Json>,"role": Database["public"]['Enums']["message_role"],"user_id"?: string
                  }
                  Update: {
                    "content"?: string,"conversation_id"?: string,"created_at"?: string,"id"?: string,"metadata"?: NonNullable<Json>,"role"?: Database["public"]['Enums']["message_role"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "coach_messages_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "coach_conversations"
      referencedColumns: ["id"]
    }
                  ]
                },"coach_recommendations": {
                  Row: {
                    "adjustments": NonNullable<Json>,"applied_version_id": string | null,"conversation_id": string | null,"created_at": string,"decided_at": string | null,"details": NonNullable<Json>,"engine_facts": NonNullable<Json>,"id": string,"kind": string,"model": string | null,"provider": string | null,"rationale": string | null,"source": string,"status": Database["public"]['Enums']["recommendation_status"],"summary": string,"title": string,"trigger_key": string | null,"user_id": string,"workout_session_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "adjustments"?: NonNullable<Json>,"applied_version_id"?: string | null,"conversation_id"?: string | null,"created_at"?: string,"decided_at"?: string | null,"details"?: NonNullable<Json>,"engine_facts"?: NonNullable<Json>,"id"?: string,"kind": string,"model"?: string | null,"provider"?: string | null,"rationale"?: string | null,"source"?: string,"status"?: Database["public"]['Enums']["recommendation_status"],"summary": string,"title": string,"trigger_key"?: string | null,"user_id"?: string,"workout_session_id"?: string | null
                  }
                  Update: {
                    "adjustments"?: NonNullable<Json>,"applied_version_id"?: string | null,"conversation_id"?: string | null,"created_at"?: string,"decided_at"?: string | null,"details"?: NonNullable<Json>,"engine_facts"?: NonNullable<Json>,"id"?: string,"kind"?: string,"model"?: string | null,"provider"?: string | null,"rationale"?: string | null,"source"?: string,"status"?: Database["public"]['Enums']["recommendation_status"],"summary"?: string,"title"?: string,"trigger_key"?: string | null,"user_id"?: string,"workout_session_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "coach_recommendations_applied_version_id_fkey"
      columns: ["applied_version_id"]
isOneToOne: false
      referencedRelation: "workout_plan_versions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "coach_recommendations_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "coach_conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "coach_recommendations_workout_session_id_fkey"
      columns: ["workout_session_id"]
isOneToOne: false
      referencedRelation: "workout_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"exercise_media": {
                  Row: {
                    "alt": string,"data": Json | null,"exercise_id": string,"id": string,"kind": string,"position": number,"url": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "alt": string,"data"?: Json | null,"exercise_id": string,"id"?: string,"kind": string,"position"?: number,"url"?: string | null
                  }
                  Update: {
                    "alt"?: string,"data"?: Json | null,"exercise_id"?: string,"id"?: string,"kind"?: string,"position"?: number,"url"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "exercise_media_exercise_id_fkey"
      columns: ["exercise_id"]
isOneToOne: false
      referencedRelation: "exercises"
      referencedColumns: ["id"]
    }
                  ]
                },"exercises": {
                  Row: {
                    "caution_tags": (string)[],"created_at": string,"default_rest_s": number,"description": string,"difficulty": number,"equipment": (string)[],"id": string,"instructions": (string)[],"is_unilateral": boolean,"measurement": string,"name": string,"primary_muscle": string,"safety_tips": (string)[],"secondary_muscles": (string)[],"slug": string
                  }
                  ComputedFields: never
                  Insert: {
                    "caution_tags"?: (string)[],"created_at"?: string,"default_rest_s"?: number,"description": string,"difficulty": number,"equipment"?: (string)[],"id"?: string,"instructions"?: (string)[],"is_unilateral"?: boolean,"measurement"?: string,"name": string,"primary_muscle": string,"safety_tips"?: (string)[],"secondary_muscles"?: (string)[],"slug": string
                  }
                  Update: {
                    "caution_tags"?: (string)[],"created_at"?: string,"default_rest_s"?: number,"description"?: string,"difficulty"?: number,"equipment"?: (string)[],"id"?: string,"instructions"?: (string)[],"is_unilateral"?: boolean,"measurement"?: string,"name"?: string,"primary_muscle"?: string,"safety_tips"?: (string)[],"secondary_muscles"?: (string)[],"slug"?: string
                  }
                  Relationships: [
                    
                  ]
                },"performed_sets": {
                  Row: {
                    "completed_at": string,"difficulty": number | null,"duration_s": number | null,"exercise_id": string,"id": string,"load_kg": number | null,"note": string | null,"pain": boolean,"pain_note": string | null,"planned_exercise_id": string | null,"reps": number | null,"rest_s": number | null,"set_number": number,"technique": NonNullable<Json>,"user_id": string,"workout_session_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "completed_at"?: string,"difficulty"?: number | null,"duration_s"?: number | null,"exercise_id": string,"id"?: string,"load_kg"?: number | null,"note"?: string | null,"pain"?: boolean,"pain_note"?: string | null,"planned_exercise_id"?: string | null,"reps"?: number | null,"rest_s"?: number | null,"set_number": number,"technique"?: NonNullable<Json>,"user_id"?: string,"workout_session_id": string
                  }
                  Update: {
                    "completed_at"?: string,"difficulty"?: number | null,"duration_s"?: number | null,"exercise_id"?: string,"id"?: string,"load_kg"?: number | null,"note"?: string | null,"pain"?: boolean,"pain_note"?: string | null,"planned_exercise_id"?: string | null,"reps"?: number | null,"rest_s"?: number | null,"set_number"?: number,"technique"?: NonNullable<Json>,"user_id"?: string,"workout_session_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "performed_sets_exercise_id_fkey"
      columns: ["exercise_id"]
isOneToOne: false
      referencedRelation: "exercises"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "performed_sets_planned_exercise_id_fkey"
      columns: ["planned_exercise_id"]
isOneToOne: false
      referencedRelation: "planned_exercises"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "performed_sets_workout_session_id_fkey"
      columns: ["workout_session_id"]
isOneToOne: false
      referencedRelation: "workout_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"planned_exercises": {
                  Row: {
                    "duration_s": number | null,"exercise_id": string,"id": string,"load_kg": number | null,"notes": string | null,"planned_session_id": string,"position": number,"reps_max": number | null,"reps_min": number | null,"rest_s": number,"sets": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "duration_s"?: number | null,"exercise_id": string,"id"?: string,"load_kg"?: number | null,"notes"?: string | null,"planned_session_id": string,"position": number,"reps_max"?: number | null,"reps_min"?: number | null,"rest_s"?: number,"sets": number,"user_id"?: string
                  }
                  Update: {
                    "duration_s"?: number | null,"exercise_id"?: string,"id"?: string,"load_kg"?: number | null,"notes"?: string | null,"planned_session_id"?: string,"position"?: number,"reps_max"?: number | null,"reps_min"?: number | null,"rest_s"?: number,"sets"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "planned_exercises_exercise_id_fkey"
      columns: ["exercise_id"]
isOneToOne: false
      referencedRelation: "exercises"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "planned_exercises_planned_session_id_fkey"
      columns: ["planned_session_id"]
isOneToOne: false
      referencedRelation: "planned_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"planned_sessions": {
                  Row: {
                    "day_of_week": number,"focus": string | null,"id": string,"plan_version_id": string,"title": string,"user_id": string,"week_number": number
                  }
                  ComputedFields: never
                  Insert: {
                    "day_of_week": number,"focus"?: string | null,"id"?: string,"plan_version_id": string,"title": string,"user_id"?: string,"week_number": number
                  }
                  Update: {
                    "day_of_week"?: number,"focus"?: string | null,"id"?: string,"plan_version_id"?: string,"title"?: string,"user_id"?: string,"week_number"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "planned_sessions_plan_version_id_fkey"
      columns: ["plan_version_id"]
isOneToOne: false
      referencedRelation: "workout_plan_versions"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "ai_provider": string | null,"available_days": (number)[],"avoided_exercise_ids": (string)[],"created_at": string,"display_name": string | null,"experience_level": Database["public"]['Enums']["experience_level"] | null,"goal": string | null,"height_cm": number | null,"id": string,"limitation_tags": (string)[],"limitations": string | null,"onboarding_completed_at": string | null,"preferred_exercise_ids": (string)[],"recovery_notes": string | null,"rest_timer_default_s": number,"session_duration_min": number | null,"sessions_per_week": number | null,"training_preferences": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ai_provider"?: string | null,"available_days"?: (number)[],"avoided_exercise_ids"?: (string)[],"created_at"?: string,"display_name"?: string | null,"experience_level"?: Database["public"]['Enums']["experience_level"] | null,"goal"?: string | null,"height_cm"?: number | null,"id": string,"limitation_tags"?: (string)[],"limitations"?: string | null,"onboarding_completed_at"?: string | null,"preferred_exercise_ids"?: (string)[],"recovery_notes"?: string | null,"rest_timer_default_s"?: number,"session_duration_min"?: number | null,"sessions_per_week"?: number | null,"training_preferences"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "ai_provider"?: string | null,"available_days"?: (number)[],"avoided_exercise_ids"?: (string)[],"created_at"?: string,"display_name"?: string | null,"experience_level"?: Database["public"]['Enums']["experience_level"] | null,"goal"?: string | null,"height_cm"?: number | null,"id"?: string,"limitation_tags"?: (string)[],"limitations"?: string | null,"onboarding_completed_at"?: string | null,"preferred_exercise_ids"?: (string)[],"recovery_notes"?: string | null,"rest_timer_default_s"?: number,"session_duration_min"?: number | null,"sessions_per_week"?: number | null,"training_preferences"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"progress_photos": {
                  Row: {
                    "created_at": string,"id": string,"note": string | null,"storage_path": string,"taken_on": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"note"?: string | null,"storage_path": string,"taken_on"?: string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"note"?: string | null,"storage_path"?: string,"taken_on"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"user_equipment": {
                  Row: {
                    "created_at": string,"details": string | null,"equipment_key": string,"id": string,"quantity": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"details"?: string | null,"equipment_key": string,"id"?: string,"quantity"?: number,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"details"?: string | null,"equipment_key"?: string,"id"?: string,"quantity"?: number,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"workout_plan_versions": {
                  Row: {
                    "change_summary": string,"created_at": string,"id": string,"plan_id": string,"recommendation_id": string | null,"source": string,"user_id": string,"version_number": number
                  }
                  ComputedFields: never
                  Insert: {
                    "change_summary": string,"created_at"?: string,"id"?: string,"plan_id": string,"recommendation_id"?: string | null,"source": string,"user_id"?: string,"version_number": number
                  }
                  Update: {
                    "change_summary"?: string,"created_at"?: string,"id"?: string,"plan_id"?: string,"recommendation_id"?: string | null,"source"?: string,"user_id"?: string,"version_number"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "workout_plan_versions_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "workout_plans"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "workout_plan_versions_recommendation_fk"
      columns: ["recommendation_id"]
isOneToOne: false
      referencedRelation: "coach_recommendations"
      referencedColumns: ["id"]
    }
                  ]
                },"workout_plans": {
                  Row: {
                    "created_at": string,"current_version_id": string | null,"goal": string | null,"id": string,"name": string,"start_date": string,"status": Database["public"]['Enums']["plan_status"],"updated_at": string,"user_id": string,"weeks": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"current_version_id"?: string | null,"goal"?: string | null,"id"?: string,"name": string,"start_date": string,"status"?: Database["public"]['Enums']["plan_status"],"updated_at"?: string,"user_id"?: string,"weeks": number
                  }
                  Update: {
                    "created_at"?: string,"current_version_id"?: string | null,"goal"?: string | null,"id"?: string,"name"?: string,"start_date"?: string,"status"?: Database["public"]['Enums']["plan_status"],"updated_at"?: string,"user_id"?: string,"weeks"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "workout_plans_current_version_fk"
      columns: ["current_version_id"]
isOneToOne: false
      referencedRelation: "workout_plan_versions"
      referencedColumns: ["id"]
    }
                  ]
                },"workout_sessions": {
                  Row: {
                    "comment": string | null,"completed_at": string | null,"created_at": string,"current_exercise_position": number,"external_ref": string | null,"id": string,"perceived_difficulty": number | null,"plan_id": string | null,"planned_session_id": string | null,"scheduled_for": string | null,"started_at": string | null,"status": Database["public"]['Enums']["session_status"],"title": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "comment"?: string | null,"completed_at"?: string | null,"created_at"?: string,"current_exercise_position"?: number,"external_ref"?: string | null,"id"?: string,"perceived_difficulty"?: number | null,"plan_id"?: string | null,"planned_session_id"?: string | null,"scheduled_for"?: string | null,"started_at"?: string | null,"status"?: Database["public"]['Enums']["session_status"],"title": string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "comment"?: string | null,"completed_at"?: string | null,"created_at"?: string,"current_exercise_position"?: number,"external_ref"?: string | null,"id"?: string,"perceived_difficulty"?: number | null,"plan_id"?: string | null,"planned_session_id"?: string | null,"scheduled_for"?: string | null,"started_at"?: string | null,"status"?: Database["public"]['Enums']["session_status"],"title"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workout_sessions_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "workout_plans"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "workout_sessions_planned_session_id_fkey"
      columns: ["planned_session_id"]
isOneToOne: false
      referencedRelation: "planned_sessions"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "_insert_plan_sessions":
{ Args: { "p_sessions": Json,"p_version_id": string }; Returns: undefined
                           },
"create_plan_version":
{ Args: { "p_change_summary": string,"p_plan_id": string,"p_recommendation_id"?: string,"p_sessions": Json,"p_source": string }; Returns: string
                           },
"create_workout_plan":
{ Args: { "p_change_summary"?: string,"p_goal": string,"p_name": string,"p_sessions": Json,"p_start_date": string,"p_weeks": number }; Returns: string
                           },
"delete_my_account":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           }
          }
          Enums: {
            "experience_level": "beginner"|"returning"|"intermediate"|"advanced","message_role": "user"|"assistant","plan_status": "active"|"archived","recommendation_status": "pending"|"accepted"|"rejected"|"superseded","session_status": "planned"|"in_progress"|"completed"|"abandoned"|"skipped"|"to_verify"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "experience_level": ["beginner", "returning", "intermediate", "advanced"],"message_role": ["user", "assistant"],"plan_status": ["active", "archived"],"recommendation_status": ["pending", "accepted", "rejected", "superseded"],"session_status": ["planned", "in_progress", "completed", "abandoned", "skipped", "to_verify"]
          }
        }
} as const
