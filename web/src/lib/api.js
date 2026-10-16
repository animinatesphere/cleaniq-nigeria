// Talks to the Cleaniq Nigeria API. In development Vite forwards /api to the local server.
const BASE = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.status = status;
    this.details = details || {};
  }
}

// No backend yet (VITE_MOCK_API=1): the website runs on sample data in the browser — see src/mock/siteApi.js.
export const MOCK = import.meta.env.VITE_MOCK_API === "1";

export async function api(path, { method = "GET", body, signal } = {}) {
  if (MOCK) {
    try {
      return await (await import("../mock/siteApi.js")).mockApi(path, { method, body });
    } catch (e) {
      throw new ApiError(e.message, e.status ?? 0, e.details);
    }
  }
  let res;
  try {
    res = await fetch(`${BASE}/api${path}`, {
      method,
      signal,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    if (e.name === "AbortError") throw e;
    throw new ApiError("We couldn't reach Cleaniq. Please check your connection and try again.", 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || "Something went wrong. Please try again.", res.status, data.details);
  return data;
}
