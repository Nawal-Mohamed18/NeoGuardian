export interface UserPreferences {
  email_alerts: boolean;
  high_risk_alerts: boolean;
  moderate_risk_alerts: boolean;
  chat_notifications: boolean;
  dashboard_compact: boolean;
  auto_refresh_dashboard: boolean;
  sound_alerts: boolean;
  assessment_confirm_before_submit: boolean;
  time_format: "12h" | "24h";
  /** Optional data-URL avatar (resized client-side). */
  avatar_data?: string;
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  email_alerts: true,
  high_risk_alerts: true,
  moderate_risk_alerts: true,
  chat_notifications: true,
  dashboard_compact: false,
  auto_refresh_dashboard: true,
  sound_alerts: false,
  assessment_confirm_before_submit: true,
  time_format: "12h",
  avatar_data: "",
};

export type SettingsSectionId =
  | "profile"
  | "appearance"
  | "notifications"
  | "security"
  | "workspace"
  | "access";
