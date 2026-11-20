# Deployment guide

Project repository: [JenkinWoo/sheeridVerify](https://github.com/JenkinWoo/sheeridVerify).

This guide is aimed at authorized school teaching, academic research, and workflow testing. Read the [Disclaimer](../DISCLAIMER.md) before use; confirm authorization and data-handling practices before using real data.

## Files and runtime requirements

| File | Purpose |
| --- | --- |
| `config/sheerid.example.json` | Application configuration template; copy it to `config/sheerid.local.json` and edit |
| `deploy/.env.web.example` | Template for the web listen address, HTTPS entry point, and password |
| `deploy/one-web.service` | systemd user service, default install path `/data/workspace/one` |
| `deploy/nginx.conf.example` | Example HTTPS reverse proxy for a self-managed Linux server |

Requires Node.js >= 22.15, npm, the Camoufox build for the current system, and the system libraries the browser needs. Headed mode also requires an available desktop session. The systemd configuration is for a Linux environment that supports user services; it is not used for local runs on Windows.

The following assumes the Linux program is located at `/data/workspace/one`. If you install it in another directory, you must also change the service's `WorkingDirectory`, `EnvironmentFile`, and `ExecStart`. Configuration files are resolved relative to the working directory.

`one` is the name of the existing deployment directory, `one-web` is the service name, and `ONE_WEB_*` is the current environment-variable prefix — these are unrelated to the GitHub project name; updating the project name does not require migrating an existing deployment. For a first deployment, you can use `git clone https://github.com/JenkinWoo/sheeridVerify.git /data/workspace/one` to clone the repository to the location assumed in this guide.

## Local preparation

Install the dependencies and the browser in the repository root:

```bash
npm ci
npm run browser:install
```

Copy the configuration in Windows PowerShell:

```powershell
Copy-Item config/sheerid.example.json config/sheerid.local.json
```

Copy the configuration on Linux and restrict permissions:

```bash
cp -n config/sheerid.example.json config/sheerid.local.json
chmod 600 config/sheerid.local.json
```

When you already have a personal configuration, edit the original file directly rather than overwriting it. At minimum, confirm `data.country`, `data.organization.name`, `data.organization.optionText`, and `data.organization.emailDomain`. The email suffix is used to generate the form email for this run; it does not mean the mailbox or school identity has been certified. Use real, authorized files for materials, and set only one of `document.path` and `document.url`.

The configuration must be standard JSON and does not support `//` comments, single quotes, or trailing commas. Quick check of the JSON syntax:

```bash
node --input-type=module -e 'import {readFile} from "node:fs/promises"; JSON.parse((await readFile("config/sheerid.local.json", "utf8")).replace(/^﻿/, "")); console.log("JSON OK");'
```

The syntax-check command above is for Bash; on Windows you can just run `npm run web` to see configuration-loading errors. Passing the syntax check does not mean all business fields are valid — the configuration is also validated when a new task is enqueued.

Start the local service:

```bash
npm run web
```

Open `http://127.0.0.1:8787`. The default access password during development is `JenkinWoo`; a public deployment must set its own password. Press Ctrl+C to stop. If the port is in use, use `npm run web -- --port 8788`; the systemd and proxy examples below all use the default port 8787.

## Instabox deployment

Upload or check out the repository code to `/data/workspace/one`, then run:

```bash
cd /data/workspace/one
npm ci
npm run browser:install
cp -n config/sheerid.example.json config/sheerid.local.json
chmod 600 config/sheerid.local.json
cp -n deploy/.env.web.example .env.web
chmod 600 .env.web
```

Edit the application configuration and `.env.web`; do not overwrite existing credentials. For the Instabox public port entry point, use:

```dotenv
ONE_WEB_HOST=0.0.0.0
ONE_WEB_PUBLIC_ORIGIN=https://your-8787-port-HTTPS-domain
ONE_WEB_PASSWORD=replace-with-a-separate-random-password
```

`ONE_WEB_PUBLIC_ORIGIN` must match the HTTPS domain actually used for access, without a path, query parameters, or credentials. Use the port domain assigned by Instabox; do not enter the SSH domain. You can run the following command in the terminal to generate a password, then write it into `.env.web` yourself:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

The password placeholder in the template is not replaced automatically, and the program does not automatically reject the placeholder, so you must change it yourself before startup. The headed browser uses `DISPLAY=:1`; make sure Instabox's Computer desktop is available; the included service file already sets this variable.

Check the Node.js path before installing the user service:

```bash
command -v node
node --version
systemctl --user show-environment >/dev/null
```

`deploy/one-web.service` uses `/usr/local/bin/node`. If the actual path differs, change the service file's `ExecStart`. Install and start:

```bash
mkdir -p ~/.config/systemd/user
install -m 644 deploy/one-web.service ~/.config/systemd/user/one-web.service
systemctl --user daemon-reload
systemctl --user enable --now one-web
systemctl --user status one-web --no-pager
```

Whether a user service keeps running after logout or a machine reboot depends on the host's user-service lifecycle. On a supported self-managed host, an administrator can run `sudo loginctl enable-linger "$USER"` as needed; a managed platform handles this per its own rules. A user service being able to start does not mean the desktop session is necessarily ready.

Open the page through the public entry point and enter the access password you set. The home page can be read publicly, while the API requires a password or a session cookie. Do not treat "the home page returns 200" as a substitute for checking the login and task APIs.

## Self-managed Linux with Nginx

Install the application, configuration, and user service per the earlier steps. When using Nginx on the same machine, keep `ONE_WEB_HOST=127.0.0.1` in `.env.web`, change `ONE_WEB_PUBLIC_ORIGIN` to your own HTTPS domain, and set a strong password. This way the application listens only on localhost and Nginx provides the public entry point.

1. Configure the domain's DNS to point to the server and obtain a valid TLS certificate for the domain.
2. Place the [Nginx template](../deploy/nginx.conf.example) into the Nginx configuration directory the server actually uses.
3. Replace `server_name`, the HTTP-redirect domain, and the certificate paths; the domain should match `.env.web`.
4. Run `sudo nginx -t`, and after the check succeeds, run `sudo systemctl reload nginx`.
5. Confirm that the page, login, and queue queries all work, and restrict unnecessary network access.

Nginx forwards the domain via `Host`, and the application verifies the Host, Origin, and write-request token. Do not resolve a proxy configuration error by removing the application's origin check. When Instabox already provides an HTTPS port entry point, there is no need to additionally deploy Nginx.

Linux with a desktop uses a real `DISPLAY` and the service configuration is changed accordingly. A server without a desktop can set `"browser": { "headless": true, "keepOpen": false, "autoFill": true }` in the application configuration; steps that require user interaction still need an operable browser environment, and headless mode is not guaranteed to complete every flow.

## Updating and restarting

First stop or wait for the current tasks to finish. The queue and history are kept only in memory; stopping or restarting the service terminates tasks and clears the queue, and does not automatically recover remote operations.

1. Back up the existing code and the private configuration, and keep the backup in a restricted directory.
2. Update the code, keeping `config/sheerid.local.json`, `.env.web`, materials, and run records; do not overwrite them with the example configuration.
3. Run `npm ci` when dependencies change; re-run `npm run browser:install` when browser dependencies change.
4. If you changed the service file, reinstall it and run `systemctl --user daemon-reload`.
5. Restart and check the status and logs, then verify public login and the queue API.

```bash
systemctl --user restart one-web
systemctl --user status one-web --no-pager
journalctl --user -u one-web -n 50 --no-pager
```

If startup fails after an update, restore the backed-up code and the corresponding dependencies, then restart. Old code may be incompatible with a new configuration, so check the configuration fields when rolling back as well.

## When configuration takes effect

| Change | When it takes effect |
| --- | --- |
| School, email suffix, browser, and polling settings in `config/sheerid.local.json` | Read when a new task is enqueued; existing tasks keep their original configuration snapshot |
| `web.concurrency` | Read at service startup or when a new task is enqueued; lowering it does not interrupt existing tasks |
| Password, listen address, and HTTPS domain in `.env.web` | Take effect after the service restarts |
| systemd service file | Takes effect after reinstalling, `daemon-reload`, and a restart |

"Resume task" reuses the stopped task's original configuration; when you want to use a new configuration, delete the stopped or failed task and re-enqueue it. After a service restart, the web page must re-authenticate the access password.

## Frequently asked questions

- **Configuration changes have no effect**: Confirm that you edited `config/sheerid.local.json` under the service's working directory, that the file is saved, and that you recreated the task. The email suffix is read first from `data.organization.emailDomain`, then from the top-level `emailDomain` and `data.emailDomain`; it is recommended to set only the first to avoid configuration conflicts in multiple places.
- **The web service fails to start**: Check whether the JSON contains comments or trailing commas and whether `web.concurrency` is a positive integer; then check the configuration permissions, the Node.js path, and the service logs.
- **The port is in use**: First check whether there is already a `one-web` service or a manually run instance; do not start multiple processes listening on 8787 at the same time.
- **The browser won't open**: Run the browser install on the system running the service, and confirm the system libraries, desktop, `DISPLAY`, and file permissions; do not copy the browser cache from another operating system.
- **The public API returns 403**: Check the actual domain, `ONE_WEB_PUBLIC_ORIGIN`, and the Host forwarded by the proxy; refresh the page after a restart to get a new session and write-request token.
- **The page shows old content**: Confirm that you are accessing the intended deployment's domain and that the code has been updated; refresh the page and check the proxy cache configuration.
- **A failed task cannot be resubmitted**: Select the failed task, click "Delete current task," then submit the original link. Deletion does not revoke an operation that has already been completed on the third-party platform.

The application configuration, `.env.web`, and `.runs/` should not be committed to Git. Before publishing, you can use `git ls-files` to verify the tracked files; being ignored by `.gitignore` does not mean already-uploaded history content disappears automatically.
