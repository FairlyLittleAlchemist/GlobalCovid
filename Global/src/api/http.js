// src/api/http.js

/**
 * API base strategy:
 * - DEV: use "/api" (Vite proxy forwards to backend) ✅
 * - PROD: set VITE_API_BASE="https://your-backend-domain" ✅
 *
 * This prevents changing code across environments.
 */
export const API_BASE = import.meta.env.VITE_API_BASE || '/api'

export function joinUrl(base, path) {
  if (!base) return path
  if (base.endsWith('/') && path.startsWith('/')) return base + path.slice(1)
  if (!base.endsWith('/') && !path.startsWith('/')) return base + '/' + path
  return base + path
}

export async function readTextSafe(res) {
  try {
    return await res.text()
  } catch {
    return ''
  }
}
