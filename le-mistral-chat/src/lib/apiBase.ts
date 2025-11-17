const LOCAL_API_BASE_URL = (import.meta.env.VITE_LOCAL_API_BASE_URL || "").replace(/\/$/, "");

export function resolveApiPath(path: string) {
  if (typeof window !== "undefined" && LOCAL_API_BASE_URL) {
    return `${LOCAL_API_BASE_URL}${path}`;
  }
  return path;
}
