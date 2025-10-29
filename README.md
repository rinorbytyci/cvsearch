# CV Search Monorepo

This repository is a pnpm workspace containing the Next.js web application, background worker, shared configuration utilities,
infrastructure as code, and CI/CD automation for the CV Search platform.

## Project Structure

- `apps/web` – Next.js 14 App Router project for the end-user experience.
- `apps/worker` – Node.js worker for asynchronous jobs.
- `packages/config` – Shared configuration helpers for loading and validating environment variables with Zod.
- `infrastructure` – Terraform configuration for MongoDB Atlas and Contabo object storage provisioning.
- `.github/workflows` – GitHub Actions workflows.

## Getting Started

Install dependencies with pnpm (requires registry access):

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

Run formatting and quality checks from the repository root:

```bash
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build
```

## Environment Variables

Copy the `.env.example` files in each app to `.env` and adjust the values for your MongoDB Atlas cluster and Contabo object storage credentials. The shared `@cvsearch/config` package enforces the required environment variables via Zod validation.

## Infrastructure

Terraform code under `infrastructure/` provisions networking, MongoDB Atlas, and Contabo object storage. Refer to the documentation inside that folder for details.

## Deployment

### Deploying `apps/web` to Vercel

1. **Prepare the repository**
   - Push the monorepo to a Vercel-supported Git provider (GitHub, GitLab, Bitbucket).
   - Ensure the workspace root defines the desired pnpm version via the `packageManager` field.
   - Commit `.env.example` files so teammates know which variables to configure.
2. **Collect required secrets**
   - `MONGODB_URI` for the production MongoDB Atlas cluster.
   - `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION`, `S3_BUCKET` for Contabo's S3-compatible storage.
   - `NEXTAUTH_SECRET`, email provider credentials, and any other secrets referenced by the app.
3. **Create the Vercel project**
   - In Vercel, click **Add New Project** and import the repository.
   - Set the **Root Directory** to `apps/web` so only the Next.js project builds.
   - Accept the detected Next.js preset so Vercel runs `pnpm install` and `pnpm run build` automatically.
4. **Configure environment variables**
   - Navigate to **Settings → Environment Variables** and add each secret for Production, Preview, and Development scopes.
   - If you use `vercel dev`, run `vercel env pull` locally to synchronize the same variables.
5. **Authorize external services**
   - Set `NEXTAUTH_URL` to the Vercel production domain and register that URL with any OAuth providers.
   - Allow Vercel's outbound IP ranges in MongoDB Atlas or rely on connection-string authentication, and confirm Contabo S3 policies permit the deployment to read/write.
6. **Deploy**
   - Trigger the initial deployment from the Vercel dashboard.
   - Monitor the build logs to ensure secrets load correctly and no database/storage connection errors appear.
   - Smoke test authentication, uploads, and other critical flows once the deployment is live.
7. **Post-deployment**
   - Enable preview deployments for pull requests.
   - Configure custom domains and DNS records.
   - Set up log drains or analytics as required for compliance and observability.

> **Note:** Background jobs in `apps/worker` are not deployed on Vercel. Host them separately (e.g., Fly.io, Railway, AWS ECS) with the same environment configuration.
