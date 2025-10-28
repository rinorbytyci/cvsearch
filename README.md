# CV Search Monorepo

This repository is an npm workspace containing the Next.js web application, background worker, shared configuration utilities,
infrastructure as code, and CI/CD automation for the CV Search platform.

## Project Structure

- `apps/web` – Next.js 14 App Router project for the end-user experience.
- `apps/worker` – Node.js worker for asynchronous jobs.
- `packages/config` – Shared configuration helpers for loading and validating environment variables with Zod.
- `infrastructure` – Terraform configuration for MongoDB Atlas and Contabo object storage provisioning.
- `.github/workflows` – GitHub Actions workflows.

## Getting Started

Install dependencies with npm (requires registry access):

```bash
npm install
```

Run the web application locally:

```bash
npm run dev --workspace @cvsearch/web
```

Run the worker locally:

```bash
npm run start --workspace @cvsearch/worker
```

Run formatting and quality checks from the repository root:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Environment Variables

Copy the `.env.example` files in each app to `.env` and adjust the values for your MongoDB Atlas cluster and Contabo object stor
age credentials. The shared `@cvsearch/config` package enforces the required environment variables via Zod validation.

## Infrastructure

Terraform code under `infrastructure/` provisions networking, MongoDB Atlas, and Contabo object storage. Refer to the documentat
ion inside that folder for details.
