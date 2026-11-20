# Contributing

You are welcome to contribute to [sheeridVerify](https://github.com/JenkinWoo/sheeridVerify) by improving the teaching examples, configuration validation, error handling, the task queue, tests, and documentation. Before contributing, please read the [Usage Notice and Disclaimer](DISCLAIMER.md).

## Development environment

Requires Node.js >= 22.15 and npm. In the repository root, run:

```bash
npm ci
npm run browser:install
npm test
```

`npm run browser:install` downloads the Camoufox build for the current system and requires network access and corresponding disk space. When the browser is not installed, browser-dependent tests are skipped; changes that involve the browser or web-page interaction should install the browser and confirm those cases actually pass.

Tests should use local pages, mock endpoints, and fictitious test data, and must not access real verification endpoints or submit real materials. See the [README](README.md) for the steps to prepare the web workbench, and the [Deployment guide](docs/DEPLOYMENT.md) for Linux deployment.

## Reporting issues

Please provide the operating system, Node.js version, reproducible steps, the expected and actual behavior, and the redacted error message. State whether you are running locally or on a remote deployment. Do not paste a full personal configuration, real verification links, materials, access password, proxy credentials, or session information.

Security vulnerabilities should be reported privately per the [Security notes](SECURITY.md); do not disclose exploitable details in a public issue.

## Submitting changes

1. Create a feature branch from the current branch, keeping each change focused on a single issue.
2. Keep the existing ESM style; when adding a configuration option, update the example and the documentation at the same time.
3. Run the relevant tests for your change; cover the corresponding behavior when it involves task status, authentication, and remote writes.
4. Before committing, run `git diff --check` and confirm that local configurations, materials, and run logs are not included.
5. In the pull request, describe the issue, the changed behavior, how you verified it, and known limitations.

Features aimed at forging proof, impersonating identities, bypassing eligibility review, or unauthorized access are not accepted. Contributors should ensure they have the rights to the content they submit; submitted code is provided under this project's [ISC license](LICENSE), and third-party content should note its source and license.
