# CV Search Monorepo

This repository is a pnpm workspace containing the Next.js web application, background worker, shared configuration utilities, infrastructure as code, and CI/CD automation for the CV Search platform.

## Project Structure

- `apps/web` – Next.js 14 App Router project for the end-user experience.
- `apps/worker` – Node.js worker for asynchronous jobs.
- `packages/config` – Shared configuration helpers for loading and validating environment variables with Zod.
- `infrastructure` – Terraform configuration for MongoDB Atlas and Contabo object storage provisioning.
- `.github/workflows` – GitHub Actions workflows.

## Getting Started

Install dependencies with pnpm:

```bash
pnpm install
```

Run the web application locally:

```bash
pnpm --filter @cvsearch/web dev
```

Run the worker locally:

```bash
pnpm --filter @cvsearch/worker start
```

Run formatting and quality checks:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Environment Variables

Copy the `.env.example` files in each app to `.env` and adjust the values for your MongoDB Atlas cluster and Contabo object storage credentials. The shared `@cvsearch/config` package enforces the required environment variables via Zod validation.

## Infrastructure

Terraform code under `infrastructure/` provisions networking, MongoDB Atlas, and Contabo object storage. Refer to the documentation inside that folder for details.
