import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
import type { UtilityPluginTool } from "@kimi-excel/shared";
import type { KimiUtilityPlugin } from "../../domain/interfaces/KimiUtilityPlugin.js";

// Extend dayjs with plugins
dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Default timezones to display
 */
const DEFAULT_TIMEZONES = [
  { timezone: "America/Los_Angeles", label: "PST (Los Angeles)" },
  { timezone: "America/Sao_Paulo", label: "São Paulo (Brazil)" },
  { timezone: "Asia/Karachi", label: "Pakistan (Karachi)" },
];

/**
 * Format time for a specific timezone using dayjs
 */
function formatTimeForTimezone(
  date: dayjs.Dayjs,
  tz: string,
  label: string
): {
  timezone: string;
  label: string;
  time: string;
  date: string;
  offset: string;
} {
  const tzDate = date.tz(tz);
  const offset = tzDate.format("Z"); // e.g., "-03:00"

  return {
    timezone: tz,
    label,
    time: tzDate.format("h:mm A"), // e.g., "9:05 PM"
    date: tzDate.format("MMMM D, YYYY"), // e.g., "February 1, 2026"
    offset: `UTC${offset}`,
  };
}

/**
 * Execute timezone tool functions
 */
export function executeTimezoneFunction(
  functionName: string,
  args: Record<string, unknown>
): string {
  const now = dayjs();
  const userTimezone = (args.user_timezone as string) || "UTC";

  switch (functionName) {
    case "get_current_time": {
      const results = [];

      // Add user's timezone first
      results.push(
        formatTimeForTimezone(now, userTimezone, `Your Time (${userTimezone})`)
      );

      // Add default timezones (skip if same as user timezone)
      for (const tz of DEFAULT_TIMEZONES) {
        if (tz.timezone !== userTimezone) {
          results.push(formatTimeForTimezone(now, tz.timezone, tz.label));
        }
      }

      return JSON.stringify({
        timezones: results,
      });
    }

    case "convert_time": {
      const timeStr = args.time as string;
      const fromTimezone = (args.from_timezone as string) || userTimezone;

      // Parse the input time
      let targetDate: dayjs.Dayjs;

      // Handle different time formats
      const time24Match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
      const time12Match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
      const fullDateMatch = timeStr.match(/^\d{4}-\d{2}-\d{2}/);

      if (fullDateMatch) {
        // Full date-time: "2024-01-15 14:30" or "2024-01-15T14:30"
        targetDate = dayjs.tz(timeStr, fromTimezone);
      } else if (time24Match) {
        // 24-hour format: "14:30"
        const hours = parseInt(time24Match[1], 10);
        const minutes = parseInt(time24Match[2], 10);
        const today = dayjs().tz(fromTimezone).format("YYYY-MM-DD");
        targetDate = dayjs.tz(
          `${today} ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`,
          fromTimezone
        );
      } else if (time12Match) {
        // 12-hour format: "2:30 PM"
        let hours = parseInt(time12Match[1], 10);
        const minutes = parseInt(time12Match[2], 10);
        const meridiem = time12Match[3].toUpperCase();

        if (meridiem === "PM" && hours !== 12) hours += 12;
        if (meridiem === "AM" && hours === 12) hours = 0;

        const today = dayjs().tz(fromTimezone).format("YYYY-MM-DD");
        targetDate = dayjs.tz(
          `${today} ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`,
          fromTimezone
        );
      } else {
        return JSON.stringify({
          error: `Could not parse time: "${timeStr}". Use "HH:MM" (24h) or "H:MM AM/PM" (12h)`,
        });
      }

      if (!targetDate.isValid()) {
        return JSON.stringify({
          error: `Invalid time: "${timeStr}"`,
        });
      }

      const results = [];

      // Source timezone
      results.push(
        formatTimeForTimezone(targetDate, fromTimezone, `Source (${fromTimezone})`)
      );

      // User's timezone (if different from source)
      if (userTimezone !== fromTimezone) {
        results.push(
          formatTimeForTimezone(targetDate, userTimezone, `Your Time (${userTimezone})`)
        );
      }

      // Default timezones
      for (const tz of DEFAULT_TIMEZONES) {
        if (tz.timezone !== fromTimezone && tz.timezone !== userTimezone) {
          results.push(formatTimeForTimezone(targetDate, tz.timezone, tz.label));
        }
      }

      return JSON.stringify({
        inputTime: timeStr,
        fromTimezone,
        conversions: results,
      });
    }

    case "list_timezones": {
      const results = [];

      // User's timezone
      results.push(
        formatTimeForTimezone(now, userTimezone, `Your Time (${userTimezone})`)
      );

      // Default timezones
      for (const tz of DEFAULT_TIMEZONES) {
        if (tz.timezone !== userTimezone) {
          results.push(formatTimeForTimezone(now, tz.timezone, tz.label));
        }
      }

      return JSON.stringify({
        configuredTimezones: results.map((r) => ({
          timezone: r.timezone,
          label: r.label,
          currentOffset: r.offset,
          currentTime: r.time,
          currentDate: r.date,
        })),
      });
    }

    case "get_timezone_difference": {
      const tz1 = args.timezone1 as string;
      const tz2 = args.timezone2 as string;

      if (!tz1 || !tz2) {
        return JSON.stringify({
          error: "Both timezone1 and timezone2 are required",
        });
      }

      try {
        const time1 = now.tz(tz1);
        const time2 = now.tz(tz2);

        // Calculate offset difference in hours
        const offset1Minutes = time1.utcOffset();
        const offset2Minutes = time2.utcOffset();
        const diffMinutes = offset2Minutes - offset1Minutes;
        const diffHours = diffMinutes / 60;

        return JSON.stringify({
          timezone1: {
            timezone: tz1,
            currentTime: time1.format("h:mm A"),
            offset: `UTC${time1.format("Z")}`,
          },
          timezone2: {
            timezone: tz2,
            currentTime: time2.format("h:mm A"),
            offset: `UTC${time2.format("Z")}`,
          },
          difference: {
            hours: Math.abs(diffHours),
            description:
              diffHours > 0
                ? `${tz2} is ${Math.abs(diffHours)} hours ahead of ${tz1}`
                : diffHours < 0
                  ? `${tz2} is ${Math.abs(diffHours)} hours behind ${tz1}`
                  : `${tz1} and ${tz2} are in the same timezone`,
          },
        });
      } catch {
        return JSON.stringify({
          error: `Invalid timezone: "${tz1}" or "${tz2}"`,
        });
      }
    }

    default:
      return JSON.stringify({ error: `Unknown function: ${functionName}` });
  }
}

/**
 * Timezone Plugin for Kimi
 *
 * Provides time display and conversion across multiple timezones.
 * Always shows PST (Los Angeles), São Paulo, and Pakistan times.
 * Detects user's local timezone from the client.
 */
export class TimezonePlugin implements KimiUtilityPlugin {
  readonly name = "timezone";
  readonly description =
    "A utility tool for displaying and converting time across multiple timezones. " +
    "Shows current time in user's timezone plus PST (Los Angeles), São Paulo (Brazil), and Pakistan. " +
    "Can also convert specific times between timezones.";

  readonly autoInclude = true;

  /**
   * Check if this plugin can handle the given function name
   * Handles both bare names (e.g., "get_current_time") and
   * prefixed names (e.g., "timezone.get_current_time")
   */
  canHandle(functionName: string): boolean {
    const functions = [
      "get_current_time",
      "convert_time",
      "list_timezones",
      "get_timezone_difference",
    ];
    // If function has a prefix, only handle if it's our prefix
    if (functionName.includes(".")) {
      const [prefix, baseName] = functionName.split(".");
      if (prefix !== this.name) {
        return false; // Different plugin's function
      }
      return functions.includes(baseName);
    }
    // No prefix - check if it's one of our functions
    return functions.includes(functionName);
  }

  /**
   * Execute a function from this plugin
   */
  execute(functionName: string, args: Record<string, unknown>): string {
    // Strip plugin prefix if present (e.g., "timezone.get_current_time" -> "get_current_time")
    const baseName = functionName.includes(".")
      ? functionName.split(".").pop() ?? functionName
      : functionName;
    return executeTimezoneFunction(baseName, args);
  }

  getToolDefinition(): UtilityPluginTool {
    return {
      type: "_plugin",
      _plugin: {
        name: this.name,
        description: this.description,
        functions: [
          {
            name: "get_current_time",
            description:
              "Get the current time across all configured timezones. " +
              "Returns the current time in the user's local timezone plus PST (Los Angeles), " +
              "São Paulo (Brazil), and Pakistan (Karachi). Use this when the user asks " +
              '"what time is it" or wants to know the current time.',
            parameters: {
              type: "object",
              properties: {
                user_timezone: {
                  type: "string",
                  description:
                    "The user's IANA timezone identifier (e.g., 'America/New_York', 'Europe/London'). " +
                    "This is detected from the user's system and passed automatically. " +
                    "If not provided, UTC is used as default.",
                },
              },
              required: [],
            },
          },
          {
            name: "convert_time",
            description:
              "Convert a specific time from one timezone to others. " +
              "Takes a time value and converts it to all configured timezones " +
              "(PST, São Paulo, Pakistan) plus the user's local timezone. " +
              'Use this when the user asks to convert a time like "what is 3pm PST in other timezones".',
            parameters: {
              type: "object",
              properties: {
                time: {
                  type: "string",
                  description:
                    "The time to convert in 24h format (e.g., '14:30') or " +
                    "12h format (e.g., '2:30 PM'). Include date as 'YYYY-MM-DD HH:MM' " +
                    "for specific dates, otherwise today's date is assumed.",
                },
                from_timezone: {
                  type: "string",
                  description:
                    "The source timezone for the time being converted. " +
                    "Use IANA timezone identifier (e.g., 'America/Los_Angeles' for PST, " +
                    "'America/Sao_Paulo' for São Paulo, 'Asia/Karachi' for Pakistan). " +
                    "Defaults to user's timezone if not specified.",
                },
                user_timezone: {
                  type: "string",
                  description:
                    "The user's IANA timezone identifier for displaying their local time. " +
                    "Detected from user's system automatically.",
                },
              },
              required: ["time"],
            },
          },
          {
            name: "list_timezones",
            description:
              "List all configured timezones with their current UTC offsets. " +
              "Use this to show the user which timezones are being tracked.",
            parameters: {
              type: "object",
              properties: {
                user_timezone: {
                  type: "string",
                  description:
                    "The user's IANA timezone identifier to include in the list.",
                },
              },
              required: [],
            },
          },
          {
            name: "get_timezone_difference",
            description:
              "Calculate the time difference between two timezones. " +
              'Use this when the user asks "how many hours ahead is X from Y" or similar.',
            parameters: {
              type: "object",
              properties: {
                timezone1: {
                  type: "string",
                  description:
                    "First timezone (IANA identifier, e.g., 'America/Los_Angeles').",
                },
                timezone2: {
                  type: "string",
                  description:
                    "Second timezone (IANA identifier, e.g., 'Asia/Karachi').",
                },
              },
              required: ["timezone1", "timezone2"],
            },
          },
        ],
      },
    };
  }

  getSystemPromptAddition(): string {
    return (
      "You have access to a timezone utility that can display and convert times across multiple timezones. " +
      "The default timezones tracked are: PST (America/Los_Angeles), São Paulo (America/Sao_Paulo), " +
      "and Pakistan (Asia/Karachi). When the user asks about time, always show all timezones. " +
      "The user's local timezone is detected from their system. Use the timezone plugin tools " +
      "to get accurate current times and conversions. IMPORTANT: Always use the date returned by the " +
      "timezone tool - do NOT use your training data for the current date. The tool provides real-time data."
    );
  }
}
