// ==========================================
// Utility Plugin Types (non-file-based tools)
// ==========================================

export interface UtilityPluginFunction {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<
      string,
      {
        type: string;
        description: string;
        default?: unknown;
        enum?: string[];
      }
    >;
    required: string[];
  };
}

export interface UtilityPluginTool {
  type: "_plugin";
  _plugin: {
    name: string;
    description: string;
    functions: UtilityPluginFunction[];
  };
}

// ==========================================
// Timezone Plugin Types
// ==========================================

export interface TimezoneInfo {
  timezone: string;
  label: string;
  time: string;
  date: string;
  offset: string;
  abbreviation: string;
}

export interface GetTimeResult {
  userTimezone: TimezoneInfo;
  timezones: TimezoneInfo[];
  utcTime: string;
}

export interface ConvertTimeResult {
  sourceTimezone: TimezoneInfo;
  targetTimezones: TimezoneInfo[];
  utcTime: string;
}

// Request types for timezone operations
export interface GetTimeRequest {
  userTimezone?: string; // IANA timezone from client (e.g., "America/New_York")
}

export interface ConvertTimeRequest {
  time: string; // Time in 24h or 12h format (e.g., "14:30" or "2:30 PM")
  fromTimezone?: string; // Source timezone (defaults to user timezone)
  toTimezones?: string[]; // Target timezones (defaults to all configured)
}

// Default timezone configurations
export const DEFAULT_TIMEZONES = [
  { timezone: "America/Los_Angeles", label: "PST (Los Angeles)" },
  { timezone: "America/Sao_Paulo", label: "São Paulo" },
  { timezone: "Asia/Karachi", label: "Pakistan" },
] as const;

export type DefaultTimezone = (typeof DEFAULT_TIMEZONES)[number];
