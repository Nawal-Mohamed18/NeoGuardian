import axios from "axios";

export function apiErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    if (!err.response) {
      return "Cannot reach the server. Make sure the backend is running on port 8000.";
    }
    const data = err.response.data;
    if (typeof data === "string") return data;
    if (data && typeof data === "object") {
      if ("detail" in data && typeof data.detail === "string") return data.detail;
      const parts: string[] = [];
      for (const [key, val] of Object.entries(data as Record<string, unknown>)) {
        if (key === "detail") continue;
        if (Array.isArray(val)) {
          for (const item of val) {
            if (item != null && String(item).trim()) parts.push(String(item));
          }
        } else if (typeof val === "string" && val.trim()) {
          parts.push(val);
        }
      }
      if (parts.length) return parts.join(" ");
    }
    if (err.response.status === 403) return "You do not have permission for this action.";
  }
  return fallback;
}
