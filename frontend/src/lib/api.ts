export type LocaleMap = Record<string, string>;

let cachedCsrf = '';

export async function getCsrfToken(): Promise<string> {
  if (cachedCsrf) return cachedCsrf;
  try {
    const res = await fetch('/api/csrf-token');
    const data = await res.json();
    cachedCsrf = data.token || '';
  } catch {
    cachedCsrf = '';
  }
  return cachedCsrf;
}

export async function apiFetch<T = any>(url: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };

  if (method !== 'GET' && method !== 'HEAD') {
    const token = await getCsrfToken();
    if (token) headers['X-CSRF-Token'] = token;
    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
  }

  const res = await fetch(url, { ...options, headers });
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    return { success: res.ok, message: text } as T;
  }
}

export async function loadLocale(lang = 'en'): Promise<LocaleMap> {
  try {
    const res = await fetch(`/api/locales/${encodeURIComponent(lang)}`);
    if (res.ok) return await res.json();
  } catch {
    // ignore
  }
  return {};
}

export function createTranslator(locale: LocaleMap) {
  return (key: string, fallback?: string) => locale[key] || fallback || key;
}

const ANSI_PATTERN = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~]|\].*?(?:\x1B\\|\x07))|\[(?:\d+(?:;\d+)*)?m/g;

export function cleanConsoleLine(line: string): string {
  return String(line ?? '').replace(ANSI_PATTERN, '');
}
