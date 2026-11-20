import { AutomationError } from '../../core/errors.js';
import { isRecord } from '../../core/config.js';
import { networkFetch } from '../../core/network.js';
import { httpResponseError } from '../../core/http.js';
import { queryStatusWithRetry } from '../../core/status-query.js';

export const stepStatuses = Object.freeze({
  success: 'verified',
  docUpload: 'document_required',
  sso: 'sso_required',
  emailLoop: 'email_required',
  pending: 'pending',
  error: 'rejected',
  collectStudentPersonalInfo: 'validation_failed',
});

// Only this step is handled by the personal-information form adapter.
export function checkVerificationStatus(context) {
  return queryStatusWithRetry(() => readVerificationStatus(context), {
    signal: context.signal, intervalMs: context.config.polling?.intervalMs, log: context.log,
  });
}

async function readVerificationStatus({ config, signal }) {
  const verificationId = new URL(config.url).searchParams.get('verificationId')?.toLowerCase();
  if (!verificationId || !/^[a-f\d]{24}$/.test(verificationId)) {
    throw new AutomationError('INVALID_CONFIG', 'The status check requires a valid verificationId');
  }
  const timeoutSignal = AbortSignal.timeout(config.timeouts.apiMs);
  const requestSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
  let body;
  try {
    const response = await networkFetch(`https://my.sheerid.com/rest/v2/verification/${verificationId}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      redirect: 'error',
      cache: 'no-store',
      signal: requestSignal,
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw httpResponseError(response, {
        code: 'STATUS_HTTP_ERROR', message: `The status API returned HTTP ${response.status}; the browser was not launched`,
      });
    }
    try {
      body = await response.json();
    } catch (cause) {
      if (requestSignal.aborted) throw cause;
      throw new AutomationError('STATUS_RESPONSE_INVALID', 'The status API did not return valid JSON; the browser was not launched', { cause });
    }
  } catch (cause) {
    if (signal?.aborted) throw new AutomationError('CANCELLED', 'The status check was canceled', { cause });
    if (timeoutSignal.aborted) {
      throw new AutomationError('STATUS_REQUEST_TIMEOUT', 'The status API request timed out; the browser was not launched', { cause });
    }
    if (cause instanceof AutomationError) throw cause;
    throw new AutomationError('STATUS_REQUEST_FAILED', 'Could not read the status API; the browser was not launched', { cause });
  }
  const errorIds = body?.errorIds ?? [];
  // Keep only bounded status codes; never log the full response or verification ID.
  if (!isRecord(body) || typeof body.verificationId !== 'string'
    || body.verificationId.toLowerCase() !== verificationId
    || typeof body.currentStep !== 'string' || !/^[A-Za-z][A-Za-z0-9]{0,63}$/.test(body.currentStep)
    || !Array.isArray(errorIds) || errorIds.length > 50
    || !errorIds.every(code => typeof code === 'string' && /^[A-Za-z0-9_.:-]{1,100}$/.test(code))) {
    throw new AutomationError('STATUS_RESPONSE_INVALID', 'The status API fields are invalid or the verification ID does not match; the browser was not launched');
  }
  const { currentStep } = body;
  if (currentStep === 'collectStudentPersonalInfo' && errorIds.length === 0) {
    return { proceed: true, currentStep, errorIds };
  }
  const status = errorIds.length > 0 ? 'rejected'
    : Object.hasOwn(stepStatuses, currentStep) ? stepStatuses[currentStep] : 'not_actionable';
  const messages = {
    verified: 'The API confirmed verification has passed; no filling is needed; the browser was not launched',
    document_required: 'Additional materials are currently required; the initial form does not need to be filled in; the browser was not launched',
    sso_required: 'School login verification is currently required; the browser was not launched',
    email_required: 'Email verification is currently required; the browser was not launched',
    pending: 'Currently waiting for review; the browser was not launched',
    rejected: 'The verification is currently in an error or rejected state; the browser was not launched; please follow the instructions on the SheerID page',
    not_actionable: 'This is not a supported student-information filling step; the browser was not launched',
  };
  return {
    proceed: false,
    outcome: { status, currentStep, errorIds, code: 'PREFLIGHT_NO_FORM', message: messages[status] },
  };
}
