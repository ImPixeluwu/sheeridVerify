import { AutomationError } from '../../core/errors.js';

// This terminal page is different from the inline, retryable human-check error.
// The regex also matches the Chinese variants of the title "We couldn't continue
// your verification" (e.g. "无法继续验证") so detection works when the page is in
// Chinese. Keep the Chinese alternatives.
const FAILURE_TITLE = /^(?:We (?:couldn['’]t|could not) continue your verification|(?:我们|我們)?(?:无法|無法)继续(?:您的)?验证|(?:我們)?無法繼續(?:您的)?驗證)[.!。]?$/i;

export async function verificationFailure(page) {
  if (page.isClosed()) return null;
  // Do not classify a login page or an unrelated site using its text alone.
  if (new URL(page.url()).origin !== 'https://services.sheerid.com') return null;
  const errorStep = page.locator('#sid-step-error').filter({ visible: true });
  const title = page.getByText(FAILURE_TITLE).filter({ visible: true });
  if (await errorStep.count() === 0 && await title.count() === 0) return null;
  return {
    status: 'failed', code: 'VERIFICATION_UNAVAILABLE',
    message: 'The SheerID page shows that verification cannot continue; this verification failed; filling, retries, and submission have stopped',
  };
}

export async function assertVerificationAvailable(page) {
  const failure = await verificationFailure(page);
  if (failure) throw new AutomationError(failure.code, failure.message);
}
