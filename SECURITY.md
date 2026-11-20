# Security notes

These notes apply to [JenkinWoo/sheeridVerify](https://github.com/JenkinWoo/sheeridVerify).

## Deployment and data

- For a public deployment, use HTTPS and set a separate strong password via `ONE_WEB_PASSWORD`; do not use the default password in the code.
- Only open the entry point to authorized personnel, and add network access restrictions as needed. This project uses a shared password and does not provide multi-tenant isolation or per-account permission management.
- Keep Node.js, the dependencies, and the browser up to date; run the relevant tests after upgrading.
- Keep `config/*.local.json`, `.env.web`, materials, and `.runs/` as private files, restrict read permissions, and clean up and back them up as actually needed.
- Do not publish the configuration files or the material directory as a static website directory. The environment-variable template is only an example and should not contain real credentials.

See the [Deployment guide](docs/DEPLOYMENT.md) for configuration and examples.

## Vulnerability reporting

If the repository has GitHub Private vulnerability reporting enabled, please report privately from the repository's **Security → Advisories → Report a vulnerability**. If that entry point is unavailable, first open an issue that only asks the maintainer for a private contact channel; do not publicly disclose vulnerability details, exploit code, or real data.

A report should include the scope of impact, the affected version, reproduction steps in a local simulated environment, and a suggested fix. Do not test unauthorized third-party systems, and do not read, modify, or submit others' data to demonstrate an issue. The repository does not currently commit to a specific response time or a support window for historical versions.
