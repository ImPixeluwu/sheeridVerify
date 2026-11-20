# sheeridVerify · Teaching and Research Verification Workflow Workbench

[![Tests](https://github.com/JenkinWoo/sheeridVerify/actions/workflows/ci.yml/badge.svg)](https://github.com/JenkinWoo/sheeridVerify/actions/workflows/ci.yml) [![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22.15-43853d)](https://nodejs.org/) [![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)

**[sheeridVerify](https://github.com/JenkinWoo/sheeridVerify)** is a Node.js-based project for studying verification workflows. It provides a local web workbench, a task queue, browser-based form interaction, and HTTP status queries, intended for school teaching, academic research, and authorized workflow testing.

> **Usage notice:** This project is provided for teaching and research purposes only. Before using it against a real platform, you must obtain the necessary authorization and comply with applicable laws and the platform's terms; you must not forge identities, enrollment status, or materials, impersonate anyone's information, fraudulently obtain benefits, or bypass eligibility review. This project has no official affiliation with or endorsement from SheerID or any school, and does not guarantee that verification will succeed. See the [Usage Notice and Disclaimer](DISCLAIMER.md) for details, and the [ISC License](LICENSE) for the code license.

## Documentation navigation

- [Quick start](#quick-start)
- [Workbench and API reference](#usage)
- [Linux / Instabox deployment, updates, and troubleshooting](docs/DEPLOYMENT.md)
- [Browser workflow guide](docs/browser-workflow.md)
- [Contributing guide](CONTRIBUTING.md) · [Security notes](SECURITY.md) · [Disclaimer](DISCLAIMER.md)

## Features

- Reads the verification status via fetch and, based on the current step, chooses the browser flow or the document-processing flow.
- Create, queue, stop, resume, and delete tasks from the web page; a failed task can be resubmitted after it is deleted.
- Limits concurrency per configuration, records task progress, and by default polls for results every 5 seconds after submission.
- Uploads raw PNG, JPEG, and PDF files; it does not generate or modify supporting materials. Interactive human verification is completed by the user.
- Protects the workbench API using an access password, a session cookie, origin checks, and a write-request token.

## Quick start

Requires **Node.js >= 22.15** and npm. Get the source from GitHub:

```bash
git clone https://github.com/JenkinWoo/sheeridVerify.git
cd sheeridVerify
```

If you downloaded the ZIP, extract it and enter the directory that contains `package.json`. In the project root, install the dependencies and the browser:

```bash
npm ci
npm run browser:install
```

On first use, copy the configuration; if you already have a personal configuration, edit the original file directly.

Windows PowerShell:

```powershell
Copy-Item config/sheerid.example.json config/sheerid.local.json
```

Linux / macOS:

```bash
cp -n config/sheerid.example.json config/sheerid.local.json
```

Edit `config/sheerid.local.json` and set the authorized country, school, `data.organization.emailDomain`, and material source. The file must be standard JSON — **`//` comments and trailing commas are not supported**. The web page generates an email from the name and the configured suffix; you should only use real addresses and data that you are entitled to use. Only one of `document.path` and `document.url` may be set; the example configuration does not include real materials ready for submission.

```bash
npm run web
```

Open **http://127.0.0.1:8787**. The default local access password is `JenkinWoo`; before exposing the service publicly you must change the password via `ONE_WEB_PASSWORD` and configure an HTTPS entry point. A headed browser on Linux requires an available desktop; for full deployment steps and the environment-variable template, see the [Deployment guide](docs/DEPLOYMENT.md).

## Testing and contributing

```bash
npm test
```

The tests use mock endpoints and local pages; they do not submit data to real verification endpoints. Browser-related cases are skipped when Camoufox is not installed; web and browser changes should be verified after installing the browser. GitHub Actions runs the tests without an installed browser on Node.js 22 and 24. Issues and improvements are welcome per the [Contributing guide](CONTRIBUTING.md); before reporting, remove personal data, credentials, and real verification links.

## License and liability notice

The project uses the [ISC License](LICENSE), consistent with the license declaration in `package.json`. Teaching and research are the intended uses of the project and do not further narrow the open-source grant of the ISC license. The software is provided as-is; third-party dependencies and platforms are each subject to their own licenses and terms. Please read the full [Usage Notice and Disclaimer](DISCLAIMER.md) before use.

## Community recognition and acknowledgments

This project recognizes and supports the open-source sharing spirit of the [LINUX DO community](https://linux.do/), and thanks the community for providing developers with a platform for technical exchange, experience sharing, and open-source project showcases. You are welcome to share your usage experience and improvement suggestions while following the community rules.

Community promotion materials are in the [LINUX DO post draft](docs/LINUX_DO_POST.md), which includes a promotion statement template and an AI-assisted project introduction image.

## How it works

The current command line first queries the status using Node.js's built-in `fetch`, then chooses which flow to run: it uses Camoufox when student information must be filled in, and the pure `fetch` API when document verification is required. Material uploads keep the file's original content, without generating or modifying any supporting file.

## Usage

### Local web workbench

```powershell
npm run web
```

Open **http://127.0.0.1:8787**. On the page you enter the verification link, first name, last name, date of birth, proxy, and access password. `url`, `firstName`, `lastName`, and `birthDate` must be passed in through the create-task API; if any is missing, enqueueing is rejected. The email is no longer passed in by the front end; instead, it is assembled automatically each time from the `emailDomain` suffix in the configuration file, in the format `First name + dot + Last name @xxx.edu` (e.g. `first.last@xxxx.edu`). Settings such as country, school, material source, browser, timeouts, and email suffix are read from `config/sheerid.local.json` each time a task starts; submitted values are not written back to the configuration file. The current and example configurations no longer store verification links or personal information.

Example JSON request body for `POST /api/jobs` (authentication still uses the session cookie or `X-Web-Password`, and write requests carry `X-Local-Token`):

```json
{
  "url": "https://services.sheerid.com/verify/ProgramID/?verificationId=VerificationID",
  "firstName": "Test",
  "lastName": "Student",
  "birthDate": "2000-01-02",
  "proxy": ""
}
```

The current configuration is used for Web/API mode. If you use the CLI separately, you must point `--config` at a standalone configuration that contains the verification link and the required data; `document.url` is still the material download address and remains in the configuration.

When a proxy is entered, the entered proxy is used; when it is empty or contains only whitespace, a direct connection is forced, and **the proxy from the configuration, the system proxy, and proxy environment variables are not used**. HTTP/SOCKS5 URLs and `host:port:username:password` are supported. `AUTOMATION_URL` also does not override the link entered on the web page.

After you click "Add to queue," tasks are automatically filled in and submitted in enqueue order, and the material flow continues per the configuration; with `browser.autoFill: false`, the original manual-fill mode is followed. The material source uses `document.path` or `document.url` from the configuration, and the name used for the download query is the one entered on the web page this time. After the submit click, the browser is kept open; it is closed and file upload continues only when the API confirms the step has entered `docUpload` with no terminating error.

The concurrency limit is controlled by `web.concurrency` in `config/sheerid.local.json` and defaults to 1. For example, to run 3 tasks at the same time:

```json
"web": { "concurrency": 3 }
```

The concurrency value must be a positive integer and is read when the service starts and when a new task is enqueued; lowering the limit does not interrupt tasks that are already running — later ones wait until a slot is free. A queued task stores a configuration snapshot taken at enqueue time. A task uses the `verificationId` in the link as its unique ID; during this run of the service, resubmitting the same ID only returns the existing task and does not run it again. A stopped task can be explicitly re-added to the tail of the queue via "Resume task," reusing the original data, proxy, and configuration; clicking repeatedly does not enqueue it again. Successful or failed tasks cannot be re-run with that button.

The queue is listed on the right; click a task to view its progress and logs. A refresh preserves the selected task. The form can be used to add different tasks one after another. Stopping a queued task cancels it immediately; stopping a running task terminates subsequent operations and releases the concurrency slot only after the corresponding browser and connections have been cleaned up, after which it can be resumed. On resume, the remote verification status is checked first; a submission that has not yet been confirmed continues with read-only queries. A task that keeps the browser open waiting for manual operation still occupies a slot. Stopping the web service cancels all queued and running tasks; the queue and history are kept only in the service's memory and are not automatically restored or retried after a restart.

By default the web server only listens on localhost, does not return the full configuration to the front end, and does not persist the entered personal data or proxy password. Waiting for review after submission continues to occupy a task slot until success, failure, or a manual stop.

After selecting a failed, finished, or stopped task on the page, you can click "Delete current task" and then re-enqueue with the same link. Deleting the last task clears the progress and activity records while keeping the form content; a running task must be stopped first and its resources must finish being cleaned up.

Delete-history-task API: `DELETE /api/jobs/:verificationId`. The request carries an authenticated session cookie or `X-Web-Password`, plus `X-Local-Token` (first obtain `token` via `GET /api/session`); no request body is needed. A task that is completed, failed, or stopped and has finished cleaning up its resources can be deleted; on success it returns HTTP 200 and `{ "id": "verificationId", "deleted": true }`. A queued, running, or stopping task returns HTTP 409 / `JOB_ACTIVE`; first call `POST /api/jobs/:verificationId/cancel` and wait for it to stop. A nonexistent task returns HTTP 404 / `JOB_NOT_FOUND`. Deletion only removes the task and its activity records from this service's memory; it does not revoke the submission on the verification platform, nor does it delete the run logs on disk. After deletion, the same ID can be re-enqueued through the normal create-task API, which still checks the remote status first.

The web page auto-refreshes progress only while there are queued, running, or stopping tasks; once all tasks have finished and their final logs have been read, polling stops. Adding, resuming, or switching tasks re-reads the status; stopped tasks are not queried repeatedly. To see tasks created on another page from an idle page, just refresh the web page.

When the initial status routing and the pre-browser-launch check encounter a network error, a timeout, or an HTTP 5xx, up to 3 attempts are made, with the retry interval increasing per `polling.intervalMs` (default 5 seconds, then 10 seconds); the wait can be canceled along with the task. HTTP 4xx (including 429) and invalid responses stop immediately during the initial check. The web page displays status-query failures, network/proxy errors, request rate-limiting, and genuine verification rejections separately, so a connection failure is not misreported as a "verification failure"; these retries are used only for read-only status queries.

### Post-submission status tracking

After automatically submitting data or materials, the program continues to query the status via fetch, by default every 5 seconds. `pending` and `emailLoop` are both intermediate states that do not end the task; the email step still requires the user to perform the email action. A normal submission flow ultimately returns `verified` (success) or `failed` (failure); a manual stop still shows "Stopped." If you only want to query the current state, `npm run status` still makes a single request.

When the server returns `docUpload` again with no terminating error, it re-requests `document.url` to get the current raw file (still carrying this run's name), requests a new upload address, and submits again; a local file is re-read. It does not reuse the previous file bytes or upload address. `rejectionReasons` are the reasons the materials were rejected; `currentStep: error` or a non-empty `errorIds` (including `docReviewLimitExceeded`) terminates with failure.

You can set `"polling": { "intervalMs": 5000 }`, in the range 1000–300000 milliseconds. Review has no human-set overall wait timeout and can be canceled via the stop button or Ctrl+C. When a query hits a temporary network outage, a timeout, or an HTTP 5xx, it retries with backoff; HTTP 429 waits as instructed only when it carries `Retry-After` and there is no terminating error. When an upload/submit response is lost, read-only queries continue first rather than directly replaying the write request; only after it is confirmed that review has been entered are subsequent new requests for additional materials handled. An unrecoverable API/material error marks the task as failed; `submissionUncertain` means the server-side result is not yet confirmed.

If the port is in use, use `npm run web -- --port 8788`. Press Ctrl+C to close the service; do not close the service terminal and then keep operating the web page.

### Instabox deployment

The program directory is `/data/workspace/one`. Using Node.js 22+, run `npm ci` and `npm run browser:install` to install the dependencies and the Camoufox build for the platform. The headed browser on Linux uses `DISPLAY=:1` and can be viewed and operated in Instabox's Computer tab; the personal configuration still uses `config/sheerid.local.json`.

For public deployment, set `ONE_WEB_HOST=0.0.0.0` and `ONE_WEB_PUBLIC_ORIGIN=https://your-domain`, and you can override the default access password `JenkinWoo` with `ONE_WEB_PASSWORD`. `ONE_WEB_USER` and HTTP Basic login are no longer used; the web page can be opened directly, and you just enter the password in the form's "Access password" field. The API verifies the password or session cookie and continues to check the origin and the write-request token. A public deployment must use an HTTPS entry point; when no listen environment variables are configured, it still listens only on localhost. After the password check succeeds, an HttpOnly, SameSite=Strict session cookie is set (plus Secure on public deployments), so refreshing the page does not require re-entering it; after a service restart you must re-authenticate.

When calling the API directly, send `X-Web-Password: JenkinWoo` (replace it when using a custom password) to `GET /api/session` and save the returned `token`. Subsequent API requests carry that password header or the returned session cookie; creating, stopping, resuming, and deleting tasks additionally require `X-Local-Token: token`. The default password exists only in the backend, and the page does not pre-fill it.

`deploy/one-web.service` can be installed to `~/.config/systemd/user/one-web.service`, with the credential environment file at `/data/workspace/one/.env.web` (permissions 600). Start it with `systemctl --user enable --now one-web`; after changing code, run `systemctl --user restart one-web`, and use `journalctl --user -u one-web` for logs. Stopping the service ends tasks; the queue is empty after the service restarts. After a server reboot you must keep the user service running and ensure the Computer desktop is available before starting browser tasks.

### Command line

Requires Node.js >= 22.15. By default it reads the verification link and material source from `config/sheerid.local.json`; when downloading network materials, it can query the raw file using the name from the configuration.

```powershell
# Route by status: when data is required, open the browser and fill it in but do not submit; other states are only reported
npm start
# Always query status only — no browser, no upload
npm run status

# Submit per the current status: the data step uses the browser, the material step uploads the specified file
npm run submit -- --file "C:\Documents\student-proof.png"

# Network material address: keep the quotes so the & in query parameters is not parsed by the shell
npm run submit -- --url "https://school.example.edu/proof?id=123"

# Use a standalone configuration file
npm run submit -- --config config/documents.local.json --file "C:\Documents\student-proof.pdf"
```

Choose either `--file` or `--url`; both override the material source in the configuration. The configuration can set `document.path` (a local path) or `document.url` (an HTTP/HTTPS address), but not two non-empty values at once; once configured, you can use `npm run submit` directly without specifying a path each time. An old `document.path` configuration still works. All relative paths are based on the working directory at the time the command is started, and a Windows JSON path must be written with double backslashes or with forward slashes. Materials are read or downloaded only when the status allows material submission and a submission mode is specified, and any verification-status write operation is initiated only after the materials have been fully read and have passed the checks.

See `config/documents.example.json` for a minimal configuration:

```json
{
  "app": "sheerid",
  "url": "https://my.sheerid.com/rest/v2/verification/REPLACE_WITH_YOUR_VERIFICATION_ID",
  "document": { "path": "C:/Documents/student-proof.png" },
  "timeouts": { "apiMs": 20000, "downloadMs": 120000, "uploadMs": 120000 },
  "artifactsDir": ".runs"
}
```

When using network materials, replace the `document` above with:

```json
"document": { "url": "https://school.example.edu/proof?id=123" }
```

The address must return raw PNG, JPEG, or PDF content directly. Query parameters and internal HTTP/HTTPS addresses are supported; the computer running the script must be able to reach it. The download does not carry browser cookies or login credentials, and it stops if a login page, HTML, or JSON is returned instead of continuing with the upload. It does not generate or modify material content.

When `data.firstName` and `data.lastName` are configured, downloading `document.url` or `--url` joins the trimmed names with a single space and writes them URL-encoded into the `name` query parameter; for example `?page=2` becomes `?page=2&name=First+Last`. Other existing parameters are preserved, and an existing `name` is replaced with the currently configured name, used to query the corresponding raw material. If a standalone material configuration does not provide a name, the original address is kept; if only part of the name is provided, the download is stopped and you are asked to complete it. Local files are not affected, and the logs do not record the name or the full download address.

The URL may also use the original `https://services.sheerid.com/verify/<programId>/?verificationId=...` page link. The `AUTOMATION_URL` environment variable can override the URL. The verification ID is read from the URL each time and is not hard-coded.

HTTP, HTTPS, and SOCKS5 proxies are supported, including username/password authentication. Add a top-level `proxy` to the local configuration:

```json
"proxy": {
  "server": "http://proxy.example.com:8080",
  "username": "YOUR_USERNAME",
  "password": "YOUR_PASSWORD"
}
```

For SOCKS5 use `"server": "socks5://proxy.example.com:1080"`, keeping the same format for the username/password fields; an unauthenticated proxy can omit those two fields. `proxy` can also be written as a string: `"http://user:password@host:port"`, `"socks5://user:password@host:port"`, or the provider-supplied `"host:port:username:password"` (HTTP by default when no protocol is specified). Special credential characters in a URL must be percent-encoded; using the separate fields is recommended to avoid manual encoding. `sock5://` is accepted as `socks5://`.

The `AUTOMATION_PROXY` environment variable can override the configuration, in the same format as the proxy string; when empty, the configuration is used.

When no proxy is configured (`proxy` omitted, `null`, an empty string, or an object whose `server`/`username`/`password` are all empty), the current system proxy is used by default: it reads the `HTTPS_PROXY`, `ALL_PROXY`, and `HTTP_PROXY` environment variables in order (any case), then reads the enabled manual proxy from Windows "Settings → Network → Proxy" (registry `ProxyEnable`/`ProxyServer`; with per-protocol settings, https takes precedence, then http, then socks). When the system proxy is off or unset, it connects directly. PAC automatic-configuration scripts and the system proxy's bypass list are not supported. To force a direct connection, set `"proxy": "direct"` (or `false`). Providing only the username/password without `server` still reports `INVALID_PROXY`; when a system proxy address cannot be parsed, it reports `INVALID_SYSTEM_PROXY`. The example configuration does not include real credentials.

The browser page's HTTP/HTTPS requests, the status pre-check, remote material downloads (including redirects), and the upload and submit APIs all share this proxy configuration; a local loopback material address accesses the local service directly. An authenticated SOCKS5 proxy is served to the browser through a local relay service that listens only on a random port on `127.0.0.1`, and remote `fetch` uses the same relay service; when the proxy is unavailable, the request fails and does not automatically fall back to a direct connection. Connections and the relay port are released when the task ends, and the proxy service is kept while the browser window is kept open. This setup is not a system-level VPN; when a proxy is enabled, a non-loopback internal material address is also accessed through the upstream proxy, which requires the upstream to be able to reach that address. It does not automatically rotate session parameters in the account or probe the exit IP.

When the form needs to be opened automatically, a complete verification page link and the required personal data must be provided; with only the status API URL, the corresponding page address cannot be determined, and it reports `FORM_URL_REQUIRED`. In Web/API mode the page link, name, email, and date of birth come from the create-task request; the current `config/sheerid.local.json` keeps only the remaining settings. A standalone CLI material configuration is used only to query status or to process the material step.

The default entry point first queries the status once to choose a branch, and each executor queries once more after acquiring the task lock. After `npm run submit` clicks submit, it keeps the browser open and tracks the status via fetch; while the API has not yet left the data step or is temporarily unavailable, it keeps waiting without clicking submit again. Only when the API explicitly returns `docUpload` with no terminating error does it close the browser and hand off to the file upload; when SSO transitions to the material step, it also waits for that API to confirm. A pending-review or email state where the upload step has not yet appeared keeps the browser open. In submit mode, on success, terminating failure, or a manual stop, the browser is still cleaned up and the window is not kept open due to `keepOpen: true`. At the upload handoff, the logs record `browser_closed` / `DOCUMENT_HANDOFF`, and the task lock and proxy are kept until the final result. The `documentRunId` in the result links the material-flow record. `npm start` still only fills in and keeps the window per `keepOpen`; `npm run status` queries only once.

If the form has already been submitted and has entered the material step, you can run `npm run submit -- --file ...` or `--url ...` directly; the program uploads per the latest status without filling in the form again. `localhost`, `127.0.0.1`, and `[::1]` in a material address connect directly to the computer running the script; other addresses use the proxy per the configuration, and the connection method is re-evaluated after a redirect.

Headed mode uses a viewport that follows the window size and does not keep using the generated viewport size when the window is resized or maximized. Dropdowns are operated according to their actual ready state: once a field is available, it waits for the unique matching option to appear, stabilize, and become clickable, then clicks it and confirms the menu has closed and the value is selected before filling the next item. Country selection clears the search filter and is compatible with country codes and English and Chinese page labels, avoiding treating `United States` as a search term for a Chinese-language option; the month is also matched by the page language. School search still uses the school name from the configuration and does not automatically select the first result.

On slow networks, each candidate-option selection waits up to `timeouts.readyMs` (default 120000 milliseconds), outputting `waiting_for_options` every 10 seconds during the wait. For a longer wait, set the value to `180000`, up to a maximum of `300000`. A wait timeout or an unconfirmed selection stops further filling and keeps the window open per the original `browser.keepOpen` configuration; the random input delay does not replace the data-loading wait.

When a school option disappears, is replaced, or becomes temporarily unclickable during an asynchronous refresh, it is re-located within the same wait window. Each click check and click waits up to 1.5 seconds, and a brief timeout does not immediately end the whole flow. After a click attempt, it first checks whether the value is already selected; it retries the selection only while the menu is still clearly expanded and the target option is ready again, without re-entering the search term or reopening a closed menu. The `code` in the wait logs distinguishes `OPTIONS_LOADING` / `OPTIONS_RELOADING` (loading or refreshing), `OPTION_STABILIZING` (waiting to stabilize), `OPTION_CLICK_PENDING` / `OPTION_CLICK_RETRY` (the click phase), and `OPTION_COMMIT_PENDING` (waiting for the selection to be confirmed). A confirmation timeout is reported separately as `OPTION_NOT_COMMITTED` and is no longer misreported as a click failure. These retries are used only for selecting form options, not for form submission or material upload.

After the school search input is complete, if the candidate list stays unchanged for 5 consecutive seconds with no loading indicator and no matching school name, it moves to the end of the input, deletes one character to re-trigger the search, and records `SEARCH_RETRIGGERED`. This happens at most once per school selection and still uses the original overall wait window and the full school-name/campus matching rules. It does not delete a character while loading, after a click on an option has been attempted, when the input content has been modified by the user, or when the input box is not editable.

Filling no longer waits indefinitely for all external images and iframes to fire `load`: after opening the page it waits up to 15 seconds for the `load` event (on timeout it records `page_load_slow` and continues), then requires the country, name, and email controls to be truly rendered — opaque (not in a fade-in phase), not covered by a loading overlay, available, and with their position unchanged for 1 continuous second — before it starts filling; each field must also be stable for 300 milliseconds before it is filled. `NOT_PAINTED`, `COVERED`, and `<settling>` in the `waiting_for_fields` logs indicate, respectively, that the control is still transparent/hidden, is obstructed, or is waiting for the layout to stabilize. The selection confirmation checks only that control and its associated menu, avoiding unrelated waits caused by loading markers on other components of the page; `OPTION_MENU_OPEN`, `OPTION_VALUE_MISMATCH`, and `OPTION_VALIDATION_PENDING` in the logs indicate, respectively, that the menu has not yet closed, the displayed value does not match, and the control's validation is not yet complete.

After a school is selected, SheerID replaces the search input box with a read-only school text box, and the original search box ID is no longer kept. The school branch gives priority to recognizing this already-selected control, checking the read-only state, the full school/campus name, and the validation state; once it confirms stability, it continues filling the name and other fields, and no longer waits for the search box that has been removed. Having only entered the search text still does not count as a selection.

When the browser launches, it excludes the uBlock Origin bundled with Camoufox, reducing the chance that verification resources are blocked by the extension. After filling is complete, it waits for the submit button in a unified way: it waits while the button is disabled, obstructed, or the page shows "Confirming you are human"; when "We couldn't confirm you are human" appears along with an available "Retry" button, it clicks retry, up to 3 times per run. Each retry first waits for the result to load, rather than clicking continuously; if the error message never changes, it waits at least 5 seconds before trying again. If it fails again after the 3rd attempt, it returns `failed` / `HUMAN_VERIFICATION_RETRY_EXHAUSTED` without submitting the form. The error message disappearing is not itself counted as success; the submit button must become clickable and there must be no verification loading/error indicator.

The total wait budget is controlled by `timeouts.humanMs`, with a cumulative default of 180000 milliseconds and a configurable maximum of 300000; the end of filling and the pre-submission phase share the budget and the retry count, rather than each retrying 3 times. When loading continues or the button stays unclickable, it fails upon reaching the budget even if the 3 retries have not been used up. The logs report the wait reason every 10 seconds and record a count such as `PAGE_RETRY_1_OF_3` for each retry. Interactive human verification is completed by the user in the browser; the script does not operate the challenge content. After `npm start` fills in and waits for the button to become ready, it ends the automatic operation and still does not click submit; only submit mode submits once after it is ready. After a failure, the window is kept open per the original `keepOpen` configuration.

## Status and API sequence

When the browser shows "We couldn't continue your verification" (or the corresponding Chinese title / the `#sid-step-error` error page), it is immediately treated as a terminating failure: `status: failed`, `code: VERIFICATION_UNAVAILABLE`, exit code 1. Page detection covers form waiting, filling, human-verification retries, and the post-submission result wait; even if submit has already been clicked, an explicit error page is not recorded as an unknown result. It does not click "Try again" on that error page, nor does it create a new verification session; this is a different state from the inline human-verification error that can be retried three times. The window is still kept open per the original `keepOpen` configuration.

Each run first requests `GET https://my.sheerid.com/rest/v2/verification/{id}` and checks the returned ID, step, and error code.

| Current status | Behavior in submit mode |
| --- | --- |
| `sso` with no error | First read the local material or download and check the network material, then `DELETE /step/sso`; continue only when it returns `docUpload` with no error |
| `docUpload` with no error | Read the local material or download and check the network material, and enter the upload flow |
| `collectStudentPersonalInfo` with no error | Open the browser and fill in; `npm run submit` also clicks submit, while `npm start` only fills in; the cancel-SSO and upload APIs are not called at this step |
| `success` | Return `verified`; do not submit again |
| `pending` / `emailLoop` | Keep querying; the email step waits for the user to complete the email action |
| `error` or a non-empty `errorIds` | Submit mode returns `failed` and stops, including `fraudRulesReject` |
| Unknown step | Submit mode returns `failed` / `UNSUPPORTED_VERIFICATION_STEP`; status-only still reports `not_actionable` |

The upload flow is:

1. `POST /step/docUpload`: send the file name, MIME type, and actual byte count. A local source uses the original file name; a network source is named `document.png`, `document.jpg`, or `document.pdf` by content, without carrying query parameters into the file name.
2. Get the `uploadUrl` from the unique document record in the response and verify that it is an HTTPS S3/SheerID address.
3. `PUT uploadUrl`: send the raw file bytes with the corresponding `Content-Type`, without multipart and without attaching SheerID cookies or an auth header.
4. After the PUT succeeds, `POST /step/completeDocUpload` and record the result per the final step returned by the API.

Local and network PNG, JPEG, and PDF are supported, with the format identified by the file header. A local source additionally checks the extension, that it is a regular file type, and that the size is consistent before and after reading; a network source does not rely on the URL extension or the response file name, and during download it accumulates a size check from the actual received bytes, so it is still limited even without a `Content-Length`. The material must be non-empty and must not exceed the project's 20 MiB limit; this is not a guarantee about the server's file-size limit, nor does it judge the authenticity of the material. Network reads are buffered only in memory and are not saved to disk.

Official API reference: [SheerID OpenAPI](https://services.sheerid.com/rest/v2/swagger.yaml). There, the description of `DELETE /verification/{id}/step/sso` is to cancel SSO and transition to `docUpload`; it is not skipping the final enrollment review, and it does not apply to a step where data is still being filled in.

## Running and results

When manual filling is needed, set `"autoFill": false` under `browser` in the local configuration, then run `npm start`. The default value is `true`; change it back to restore automatic filling. Manual mode still decides whether to open the form based on the current verification status; after the form opens, it skips data validation, field waiting, automatic filling, human-verification retries, and automatic submission, keeping the window for you to operate, and cleans up the task after you close the window or press Ctrl+C. It requires `headless: false` and cannot set `keepOpen: false`; this mode rejects `--submit` only at the data-filling step. After a manual submission enters the material step and the old task window is closed, you can use `--submit` to upload materials without re-enabling automatic filling; `--status` still only queries the status.

The manual-mode result is `status: manual` / `code: MANUAL_MODE`, which only means the page has been opened and handed to the user — not that filling is complete or verification has passed. Subsequent manual filling, submission, and the verification result are determined by the browser page; `submissionAttempted` only records whether the script submitted. This switch does not disable the web page's own JavaScript.

When the startup pre-check or a write request hits HTTP 429, it still reports `API_RATE_LIMITED` and stops. The post-submission read-only polling waits and retries only when there is a `Retry-After` and the response does not contain a terminating error; with no recovery time, or once a business limit has been reached, it fails and does not retry continuously.

Both the status and material APIs go through `fetch`. Write requests are not automatically retried directly; read-only polling and server-side requests for new additional materials are handled per the rules above. The status and upload APIs do not follow redirects. A network material download follows at most 3 HTTP/HTTPS redirects, forbids HTTPS downgrade to HTTP, and does not accept credentials embedded in the URL; the timeout covers the entire download-and-redirect process. The API default timeout is 20 seconds, and the download and upload each default to 120 seconds, configurable separately via `timeouts.apiMs`, `timeouts.downloadMs`, and `timeouts.uploadMs`. Ctrl+C cancels the current task and releases the task lock.

Standard error outputs the phase logs; standard output returns the final JSON. `.runs/<runId>.json` stores the status, phase, and error code; it does not store material bytes, file paths, the material source URL, the presigned upload URL, or full API responses. Before each remote write, a `submission_unknown` record is still saved for crash recovery; during normal operation, a lost response continues with read-only queries and ultimately records success or failure. After the service exits, it does not automatically replay an unconfirmed submission.

In the material-branch result, `remoteWriteAttempted` records whether the remote-write flow has been entered, and `submissionAttempted` records whether the complete-upload request has been entered; `browserOpened` is `false`. In the browser branch, `submissionAttempted` indicates whether a submit click was attempted, and `browserOpened` indicates whether a browser session has been created. `pending` means waiting for review; only when the API returns `success` is `verified` recorded.

| Result | Exit code |
| --- | --- |
| `filled` / `verified` / `manual` | 0 |
| `failed` / `rejected` | 1 |
| `document_required` / `sso_required` / `personal_info_required` / `email_required` / `human_verification_required` / `pending` / `not_actionable` | 2 |
| `submission_unknown` | 3 |
| User interruption | 130 |

The same verification ID uses the same task lock, including mutual exclusion with a historical browser flow. While an old browser task is still running, you should close that task normally first. The configurations `*.local.json`, `.runs/`, and `documents/` are all ignored by Git.

## Modules and extension

```text
src/cli.js                              Command line that routes by status
src/core/workflow.js                    Routing between the browser and material APIs
src/core/http.js                        fetch, timeouts, cancellation, and error handling
src/core/proxy.js                       Proxy configuration parsing, without exposing credentials in errors
src/core/network.js                     Task-level proxy relay and fetch routing
src/apps/sheerid/client.js               Status and material API client
src/apps/sheerid/document.js             Local reading, network download, and unified format checks
src/apps/sheerid/document-workflow.js    State machine, task lock, and result recording
src/core/config.js                      Unified configuration
src/core/storage.js                     Lock and atomic result saving
```

```javascript
import { loadConfig, runDocumentWorkflow } from './src/index.js';
const config = await loadConfig('config/sheerid.local.json');
const status = await runDocumentWorkflow(config); // query only
// When you have a file and have confirmed a submission is needed:
const result = await runDocumentWorkflow(config, {
  submit: true,
  file: 'C:/Documents/student-proof.png',
});
```

In the call above, a network source replaces `file` with `url: 'https://school.example.edu/proof?id=123'`. The entry point for the unified routing library is `runWorkflow(config, { submit, statusOnly, file, url, signal })`; here `url` is the material address, while the verification address is still provided by `config.url`. Calling `runDocumentWorkflow` directly always uses only the material API, and returns `personal_info_required` when it reaches a data-filling step. The browser branch calls `runAutomation`, and Camoufox is lazy-loaded by the CLI only when a form is needed; the original random input, keep-window, and fingerprint configurations apply only to the browser branch. For more browser settings, see [docs/browser-workflow.md](docs/browser-workflow.md); for the history of command descriptions, this README is authoritative.

Running `npm test` executes the offline regression tests, covering the handoff from the browser to the material flow, the task lock, a lost upload response, the download name parameter, and local material download. When Camoufox is installed, it also runs the local test page for school search; otherwise those browser cases are skipped. The tests do not access real verification endpoints.
