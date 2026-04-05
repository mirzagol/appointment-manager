/** API root: same-origin /api when proxied (dev + Docker nginx); else full URL for split deploys. */
export const API_BASE =
  import.meta.env.VITE_API_BASE_URL !== undefined &&
  import.meta.env.VITE_API_BASE_URL !== ""
    ? import.meta.env.VITE_API_BASE_URL
    : import.meta.env.DEV
      ? "/api"
      : "http://localhost:3000";
