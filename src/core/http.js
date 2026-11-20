import { AutomationError } from './errors.js';
import { networkFetch } from './network.js';

export function httpResponseError(response, {
  code = 'API_HTTP_ERROR', message = `The API returned HTTP ${response.status}; the flow has stopped`,
} = {}) {
  let retryAfterSeconds;
  if (response.status === 429) {
    const value = response.headers.get('retry-after')?.trim();
    const seconds = /^\d+$/.test(value ?? '') ? Number(value)
      : /^[A-Za-z]{3},\s/.test(value ?? '') ? Math.ceil((Date.parse(value) - Date.now()) / 1000) : NaN;
    if (Number.isSafeInteger(seconds)) retryAfterSeconds = Math.max(0, seconds);
    code = 'API_RATE_LIMITED';
    const guidance = retryAfterSeconds !== undefined
      ? `Please wait at least ${retryAfterSeconds} seconds before retrying manually`
      : 'The server did not provide a recovery time; please try again later and avoid running continuously';
    message = `The API returned HTTP 429 (rate limited); the flow has stopped; ${guidance}`;
  }
  const error = new AutomationError(code, message);
  error.httpStatus = response.status;
  if (retryAfterSeconds !== undefined) error.retryAfterSeconds = retryAfterSeconds;
  return error;
}

// Network operations deliberately have no automatic retry, including uploads and step changes.
export async function fetchData(url, { method = 'GET', json, bytes, mimeType, timeoutMs, signal, binary = false } = {}) {
  const deadline = AbortSignal.timeout(timeoutMs);
  const combined = signal ? AbortSignal.any([signal, deadline]) : deadline;
  try {
    const response = await networkFetch(url, {
      method, redirect: 'error', cache: 'no-store', signal: combined,
      headers: binary ? { 'Content-Type': mimeType } : {
        Accept: 'application/json', ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: binary ? bytes : json === undefined ? undefined : JSON.stringify(json),
    });
    if (!response.ok) {
      const error = httpResponseError(response);
      if (method === 'GET' && response.status === 429) {
        // 429 can also mean a permanent program/consumer limit. Even when an
        // intermediary adds Retry-After, never retry a terminal error response.
        const body = await response.json().catch(() => null);
        error.terminal = body?.currentStep === 'error' || (Array.isArray(body?.errorIds) && body.errorIds.length > 0);
      }
      await response.body?.cancel().catch(() => {});
      throw error;
    }
    if (binary) {
      await response.body?.cancel().catch(() => {});
      return;
    }
    try { return await response.json(); } catch (cause) {
      if (combined.aborted) throw cause;
      throw new AutomationError('API_RESPONSE_INVALID', 'The API did not return valid JSON; the flow has stopped', { cause });
    }
  } catch (cause) {
    if (signal?.aborted) throw new AutomationError('CANCELLED', 'The API operation was canceled', { cause });
    if (deadline.aborted) throw new AutomationError('API_TIMEOUT', 'The API operation timed out; please query the current status before deciding whether to retry', { cause });
    if (cause instanceof AutomationError) throw cause;
    throw new AutomationError('API_NETWORK_ERROR', 'The API request failed; please query the current status before deciding whether to retry', { cause });
  }
}
