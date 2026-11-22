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
- Project Present: https://www.convex-project.abrdns.com/present/ (legacy Presentr hostname redirects)
- Project Sites: https://www.convex-project.abrdns.com/sites/ (legacy Siteify hostname redirects)
- Project Forms: https://www.convex-project.abrdns.com/forms/ (legacy Formr hostname redirects)
- Retired Cloudbase address: redirects to the products page when routed through Project

The three products share the main Project origin and use /present/, /sites/ and /forms/ path prefixes. The previous product subdomains are retained as legacy redirects.
