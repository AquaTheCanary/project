# Project

Project is the connected creative workspace from **Convex, LLC**.

## Products
- **Project Present** — interactive presentations (existing Presentr address).
- **Project Sites** — visual website creation and publishing (existing Siteify address).
- **Project Forms** — forms, surveys and response collection (existing Formr address).

Cloudbase has been retired from the product suite. Legacy Cloudbase data paths are retained temporarily to avoid deleting existing user files.

The Project web application is a static-first frontend with Firebase authentication and Firestore-backed features, plus the existing publishing and serverless integrations.

## Deployment
The production site is published from the `main` branch. Preserve the existing Firebase configuration, Cloud Functions, publishing API and deployment settings when changing the frontend.

For the project documentation and contribution guidance, see [the repository documentation](https://github.com/AquaTheCanary/project/tree/main/github/assets).

## Product addresses
- Project: https://www.convex-project.abrdns.com
- Project Present (existing URL): https://www.presentr.convex-project.abrdns.com
- Project Sites (existing URL): https://www.siteify.convex-project.abrdns.com
- Project Forms (existing URL): https://www.formr.convex-project.abrdns.com
- Retired Cloudbase address: redirects to the products page when routed through Project

These hostnames need matching DNS records and hosting custom-domain bindings before they resolve publicly.
