// Shared API configuration - single source of truth for backend URL
const rawBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
export const API_BASE_URL =
  rawBaseUrl !== undefined
    ? rawBaseUrl.trim().replace(/\/$/, "")
    : "http://localhost:8000";

