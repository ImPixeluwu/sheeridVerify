# sheeridVerify

A verification-workflow workbench for school teaching, academic research, and authorized testing.

Project address: https://github.com/JenkinWoo/sheeridVerify

## Project introduction

sheeridVerify is a Node.js-based open-source learning project that brings HTTP status queries, browser form interaction, and a task queue together in a single workbench, making it convenient to observe a task's process from creation to completion and to study API calls, state machines, and asynchronous task management.

## Existing features

- Create tasks and view the queue and activity records from the web page.
- Set a task concurrency limit, and stop or resume a stopped task.
- Delete a failed, finished, or stopped task, and then resubmit the same link.
- Use fetch to query status, keep querying every 5 seconds by default after submission, and retry with backoff on some network errors.
- Choose the Camoufox browser flow or the raw material-upload flow based on the current step.
- Protect the API with an access password, a session cookie, a request-origin check, and a write-request token.

## Installation and deployment

Requires Node.js >= 22.15 and npm. The repository includes an example configuration, a Linux / Instabox deployment guide, a systemd service file, and an Nginx HTTPS template. The tests use mock endpoints and local pages; browser-related cases require Camoufox to be installed.

## Use and open-source license

The project is provided solely for school teaching, academic research, and authorized workflow testing, and does not guarantee that verification will succeed. Please use real identity data and materials that you are entitled to use, comply with applicable laws, platform terms, and school rules, and do not use it to forge eligibility, impersonate information, or fraudulently obtain benefits. The project has no official affiliation, endorsement, or guarantee relationship with SheerID or any school.

The code uses the ISC open-source license; see the repository for the full license and disclaimer. Real platforms, network services, and the third-party browser are each subject to their own terms and licenses.

## Community

This project recognizes and supports the open-source sharing spirit of the LINUX DO community, and the README has added a community link and acknowledgments. You are welcome to share your teaching usage experience, report reproducible issues, or submit improvement suggestions.

LINUX DO: https://linux.do/

This is an AI-assisted project introduction, to be published as an image after review by the poster.
