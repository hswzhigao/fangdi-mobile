interface ApiEnv {
  VITE_API_URL?: string;
}

interface ApiFetchOptions {
  apiBase?: string;
}

type FetchLike = typeof fetch;

const PINME_API_URL_PLACEHOLDER = '__PINME_VITE_API_URL__';

function trimBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

function normalizeConfiguredValue(value: string | undefined): string {
  const trimmed = (value ?? '').trim();
  return trimmed || PINME_API_URL_PLACEHOLDER;
}

// API Config
// 请求后端服务器的域名地址 / Backend server domain address
// 禁止改动 / DO NOT MODIFY
export function getConfiguredApiBase(env: ApiEnv = import.meta.env): string {
  return trimBaseUrl(normalizeConfiguredValue(env.VITE_API_URL));
}

export const API = getConfiguredApiBase();

export function getApiUrl(path: string, options: ApiFetchOptions = {}): string {
  const apiBase = trimBaseUrl(options.apiBase ?? API);
  // Return relative path when API base is the PinMe placeholder (not yet configured)
  // or when it is completely empty. Relative paths go through the Vite proxy in dev.
  if (!apiBase || apiBase === PINME_API_URL_PLACEHOLDER) {
    return path;
  }
  return `${apiBase}${path}`;
}

export async function apiFetch(
  path: string,
  init?: RequestInit,
  fetchImpl: FetchLike = fetch,
  options: ApiFetchOptions = {},
): Promise<Response> {
  return fetchImpl(getApiUrl(path, options), init);
}
