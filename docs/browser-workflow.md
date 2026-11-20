# Historical browser workflow guide

This file preserves the description of the original browser implementation; the historical usage of `npm start` / `npm run submit` here no longer applies, and the current command-line behavior is governed by the root `README.md`. The browser implementation can still be called through the library entry point `runAutomation`.

# Camoufox application automation

A Node.js ESM project that reuses the existing `camoufox` / `playwright-core` without introducing runtime dependencies. The first adapter handles the SheerID student-information form, with the browser layer separated from the business adapter.

## Usage

Requires Node.js >= 22.15. First-time installation:

```powershell
npm ci
npm run browser:install
```

The existing Windows browser-install patch is kept in `scripts/install-browser.js` and applies only to Camoufox 0.5.9; when upgrading that dependency, check the patch in sync.

This workspace has already generated `config/sheerid.local.json` and written the provided verification link into it; that file is ignored by Git. A new workspace can copy the example:

```powershell
Copy-Item config/sheerid.example.json config/sheerid.local.json
```

Fill in the country, name, email, date of birth (`YYYY-MM-DD`), and school information in the local configuration. `data.country` is required, for example `United States` or `US`; the school input box is disabled when the current page has no country selected. `organization.name` is the search text, and `organization.optionText` is recommended to be the full candidate name with city/state, for example search `Marshall University` and set the option to `Marshall University Huntington, WV`. Only fill in your own information or information you are authorized to submit.

School options are matched by full match first, with tolerance for comma and whitespace separator differences: a page option displays the school name and location in two text blocks, so its accessible name is `Marshall University Huntington, WV`, while the input box after selection may display `Marshall University, Huntington, WV`. The tolerant match keeps all of the school name, city, and state text, and requires the candidate to be unique.

When `optionText` is the same as the search school name `name`, a unique candidate of "full school name + location in a comma or parentheses," or a candidate with an independent full-school-name text block, is also allowed; a school is not chosen by an arbitrary substring or by defaulting to the first item. If multiple campuses match, it records `AMBIGUOUS_OPTION`, in which case you should fill in the full candidate name. When the full campus name is explicitly provided, the location-suffix fallback is not used.

```powershell
# Auto-fill and submit once
npm run submit

# Specify another configuration
npm run submit -- --config config/sheerid.local.json

# Only fill in, do not click submit; keep the browser open afterward for viewing or manual operation
npm start
```

You can use `$env:AUTOMATION_URL = 'full verification link'` to override the configured URL. The link must include `verificationId`; an expired link must be updated. All relative paths are based on the working directory at the time the command is started.

### Querying the verification status before startup

Both `npm start` and `npm run submit` first extract `verificationId` from a valid configured URL and request `GET https://my.sheerid.com/rest/v2/verification/{verificationId}` via Node.js's built-in `fetch`. The verification ID is not hard-coded in the code, and no separate API URL needs to be configured. Only when the API returns `currentStep: collectStudentPersonalInfo` with an empty `errorIds` does it validate the form data and launch Camoufox.

| API step/result | Behavior |
| --- | --- |
| `collectStudentPersonalInfo` with no error | Validate the data, open the browser, fill in; submit mode submits once more |
| `success` | Record `verified`, do not open the browser |
| `docUpload` / `sso` / `emailLoop` / `pending` | Report that material, school login, email verification, or waiting for review is required; do not open the browser |
| `error` or a non-empty `errorIds` | Record `rejected` and the error code, do not open the browser |
| Other steps | Record `not_actionable`, do not open the browser |
| Request failure, timeout, HTTP error, JSON/field anomaly, returned ID mismatch | Report a status-check error, do not open the browser |

`timeouts.apiMs` defaults to 20000 milliseconds, covering the request and reading the JSON; the configurable range is 1000–300000. The request is read-only, does not retry automatically, does not follow redirects, and does not fall back to a browser attempt on failure. The status-check phase is `preflight`; the result includes `browserOpened`, and a normal status response also includes `currentStep` and `errorIds`, without saving the API's raw content. A status that does not require filling does not require complete personal data; after the result is saved, it releases the task lock and exits directly. An existing browser process is not closed by this check.

The status may change after the check, so after the page opens it still keeps the error-page check and the submit-button-ready determination. This development only directly queried the status API specified by the user and did not run a fill or submit test.

Headed mode keeps the browser open by default and does not automatically close an existing page after filling, submitting, or a failed run. When done, a `browser_kept_open` log appears and the script keeps waiting; you can manually view, modify, or keep operating the page. Only closing the task tab/window, or pressing Ctrl+C in the terminal, ends the wait and cleans up the browser and the task lock. The existing configuration does not need to be changed; if you want automatic closing, set `browser.keepOpen: false`. Headless mode closes automatically by default and does not allow setting `keepOpen: true`.

### Session and fingerprint on each startup

Each run creates a new Camoufox browser process, then uses Camoufox's `NewContext()` to generate and install a new context fingerprint. At startup, persistent context and fixed presets are explicitly disabled, and no saved fingerprint, user profile directory, or `storageState` is passed in, so the previous cookies, local storage, or login state are not restored. The `browser_identity_created` / `FRESH_CONTEXT` in the logs indicates that this creation flow has completed; it is not proof of fingerprint uniqueness against a detection website.

Camoufox 0.5.9 re-randomizes by default when no fixed fingerprint/preset is passed in, and `NewContext()` also regenerates the context fingerprint. Random generation does not guarantee that every field changes or that there are absolutely no duplicates; the browser version, configured language, operating system, and some hardware-related values may stay the same. This change does not enable a proxy, so the exit IP does not change automatically as a result. While the browser window stays open, refreshing or continuing to operate still belongs to the current context; a new context is created only after it is closed and restarted.

The browser session is different from the SheerID verification session: the same `verificationId` in the configured URL still corresponds to the same verification on the server, and changing the browser fingerprint does not create a new verification record. This adjustment was made based on the installed dependency's source and did not launch multiple browser rounds or run fingerprint-difference tests.

The country, month, and school all support both a native `select` and a custom dropdown with ARIA `option`s. A custom dropdown expands the menu and selects the corresponding option, rather than only writing text into the input box. The full country name and the school `optionText` should match the text displayed on the page; a two-letter country code and the birth month are converted to option text per `browser.locale`, so keep that configuration consistent with the page language (the current page is English, default `en-US`). The optional `data.consent: true` is used to check the consent item on the page; when not configured, that field is not operated.

### Random fill intervals

By default it types character by character, with a random interval of 40–120 milliseconds per character; a random wait of 500–1200 milliseconds before each field starts and before a custom dropdown option click; and a random wait of 1000–2000 milliseconds before submission. After a normal text field is filled, it blurs to trigger form validation. Waits and typing support Ctrl+C cancellation and do not automatically resubmit on retry.

An old configuration uses the defaults directly. You can add an `interaction` adjustment at the top level of the local JSON (the following is a configuration snippet):

```json
{
  "interaction": {
    "keyDelayMs": { "min": 40, "max": 120 },
    "fieldDelayMs": { "min": 500, "max": 1200 },
    "submitDelayMs": { "min": 1000, "max": 2000 }
  }
}
```

The units are all milliseconds; `min` and `max` must be integers with `0 <= min <= max`; the character interval has a maximum of 1000 and the other intervals a maximum of 10000. Setting both min/max of an item to 0 disables that wait. The `interaction_delay` log reports the field name and this interval, without recording the input content.

### Page load and dynamic form waiting

The execution order of auto-fill is: `preflight` queries the API to confirm that filling is required → validate the data → open the page → `wait_ready` waits for the page `load`, the country control to be available, and the name/email to be editable → `fill` select the country → wait for the school input box to be enabled and select the school → fill in the name → fill in the date of birth (month, day, year) → fill in the email → optional submit. The initial phase does not wait for the still-disabled school input box, to avoid a waiting loop. The read-only dropdown controls for country and month only require availability, not the ability to enter text. School search results separately wait for the exact-match option.

`timeouts.readyMs` defaults to **120000 milliseconds**, and the existing local configuration takes effect without changes; it can be set explicitly under `timeouts`, in the range 1000–300000. The page load and the first round of form checks share this budget, after which each dynamic field uses this wait budget. `actionMs` is still used for normal operations, and `navigationMs` for the initial navigation.

Only after `form_ready` appears in the logs does it enter filling; `field_started` / `field_filled` show the name of the field currently being operated, and `waiting_for_fields` reports the wait status when the set of fields awaiting readiness changes or every 10 seconds, without recording field values. Exceeding the wait time records `PAGE_LOAD_TIMEOUT` or `FORM_NOT_READY`; the latter lists the fields that did not appear or are not operable. When a dropdown option does not match, it reports `OPTION_NOT_FOUND` with the field name. If the page is already displayed but a field still cannot be matched, the selectors need adjusting; simply increasing the wait time cannot solve a selector mismatch.

Before submission it waits for the button to become enabled, using at most the `readyMs` wait budget, and reports `waiting_for_submit` every 10 seconds; a persistently disabled or unclickable button reports `SUBMIT_NOT_READY`. The current page's `#sid-step-error` (for example "We couldn't continue your verification") is recognized as `VERIFICATION_UNAVAILABLE`, stopping automatic operation and keeping the window open. A random delay does not lift a server-side rejection, which must be handled per the page's instructions. The logs immediately show the description of a classified error while the browser stays open; this tool does not force the button to be enabled or automatically re-initiate verification.

## Current verification scope

The actual page the user opened has been reviewed, and the control identifiers of the school `sid-college-name`, the date of birth `sid-birthdate-day` / `sid-birthdate-year`, the country and month dropdowns, and the submit button have been checked, with the adapter corrected accordingly. As requested, automated tests were not run and the fill/submit flow was not re-executed; the dropdown-selection interaction and the submit response are still not verified end to end. The target form may differ by region, language, or program settings. The selectors are centralized in `src/apps/sheerid/selectors.js` and can also be overridden field by field in JSON:

```json
{
  "selectors": {
    "firstName": ["input[name='firstName']"],
    "submit": ["form#student-form button[type='submit']"]
  }
}
```

The above is only a configuration snippet and should be merged into the full configuration. The array looks up visible elements in priority order, and matching multiple elements raises an error, to avoid selecting the wrong form. The submit result listens to `POST /rest/v2/verification/{id}/step/collectStudentPersonalInfo` for the same verificationId; if the program uses a different endpoint, the adapter must be modified. Only when the API explicitly returns `currentStep: success` is review marked as passed.

## Results and run management

Standard output contains the final JSON; standard error outputs structured event logs. `.runs/<runId>.json` stores the result; it does not store the name, email, school, date of birth, verification link, or the API's raw content, nor does it automatically generate screenshots, HAR, or a trace.

| Status | Meaning | Exit code |
| --- | --- | --- |
| `filled` | Filling only was completed | 0 |
| `verified` | The API explicitly confirmed that verification succeeded | 0 |
| `document_required` / `sso_required` / `email_required` | Material, school login, or email verification is required | 2 |
| `pending` | Waiting for review | 2 |
| `not_actionable` | The API returned an unsupported step; the browser was not launched | 2 |
| `validation_failed` / `rejected` / `failed` | Field validation, a service rejection, or an execution failure | 1 |
| `submission_unknown` | Submission was attempted, but the result cannot be confirmed | 3 |

The exit code is 130 when an interrupt signal is received. Subsequent material upload, school login, email verification, and CAPTCHA are handled by the user; this adapter only implements the initial personal-information submission.

Each run clicks only once and does not automatically retry submission. Before clicking, a `submission_unknown` record is written first, to prevent a crash from leaving a false success result. After a timeout or interruption, first check the verification page/result record, then decide whether to re-run; an unknown result must not be treated as a submission failure. The task lock is created from the SHA-256 of the verification ID, preventing processes that share the same `.runs` directory from operating on the same session at the same time; it does not provide a cross-machine distributed lock or cross-run business idempotency. An abnormal termination may leave a `.lock`; after confirming that the PID in the record is no longer running, manually delete the corresponding lock file.

The result is saved immediately after the automation step ends; while the browser is kept, it still holds the task lock, to prevent another process from operating on the same session. Manual operations do not overwrite the automation result; the library call and the CLI's final standard output return after the window is closed. SIGINT/SIGTERM received during a run or while the window is kept tries to close the launched browser and release the task lock; an interruption during the startup phase must wait for startup to return before releasing resources. The personal configuration and the run directory are both ignored by Git, and actual file access permissions are managed by the local account / Windows ACL.

## Extending the application

```text
src/
  cli.js                  Command-line arguments, signals, exit codes
  index.js                Library entry point
  core/                   Configuration validation, errors, logging, result storage, executor
  browser/                Camoufox lifecycle, generic form operations
  apps/
    registry.js           Application registry
    sheerid/              SheerID validation, fields, and submit-result interpretation
config/                   Example and private local configuration
```

Add `src/apps/<app>/index.js` and register it in the registry, providing the following interface:

```javascript
export const application = {
  validate(config) {},             // Validate the basic configuration needed for a status query, such as the URL
  identity(config) { return 'application:session-key'; },
  async preflight({ config, signal, log }) { // Optional: query the status before launching the browser
    return { proceed: true };      // or { proceed: false, outcome: { status, code, message } }
  },
  validateInput(config) {},        // Optional: validate form data only when the browser needs to be opened
  async waitUntilReady({ page, config, signal }) {}, // Optional: readiness conditions for the page and business form
  async fill({ page, config, log, signal }) {},
  async submit({ page, config, markSubmissionAttempted }) {
    // Record before a remote write may occur; an exception that happens afterward is treated as an unknown result.
    await markSubmissionAttempted();
    // Perform the submission and determine the business result.
    return { status: 'pending', code: 'AWAITING_REVIEW' };
  },
};
```

The application must call and await `markSubmissionAttempted()` before submitting, and must not automatically retry the remote write. A new status requires extending the CLI exit-code mapping in sync. The adapter returns only a status without personal data and a fixed error code.

It can also be called directly from another application:

```javascript
import { loadConfig, runAutomation } from './src/index.js';
const config = await loadConfig('config/sheerid.local.json');
const result = await runAutomation(config, { submit: true });
```

Later, you can add a queue, database, or HTTP service per actual business needs to reuse the executor; the current implementation is a single-task CLI/library and does not include a background service or distributed scheduling.
