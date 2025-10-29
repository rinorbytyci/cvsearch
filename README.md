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

### Running the stack locally

1. **Install prerequisites**
   - Node.js 20 LTS and pnpm (the workspace pins the version through the `packageManager` field).
   - A MongoDB instance: either a local Docker container (`docker run -p 27017:27017 mongo:7`) or a MongoDB Atlas cluster.
   - Access to a Contabo S3-compatible bucket, or an S3 emulator such as LocalStack/MinIO for purely local testing.
2. **Configure environment variables**
   - Copy `apps/web/.env.example` to `apps/web/.env` and set `MONGODB_URI`, `S3_*` credentials, and any authentication secrets.
   - Copy `apps/worker/.env.example` to `apps/worker/.env` so the worker shares the same configuration.
3. **Install dependencies**
   - Run `pnpm install` from the repository root to install workspace dependencies.
4. **Start required services**
   - Launch the Next.js app: `pnpm --filter @cvsearch/web dev` (runs on `http://localhost:3000`).
   - In a separate terminal, start the worker: `pnpm --filter @cvsearch/worker start`.
   - If using a local S3 emulator, ensure it is running and that the bucket referenced in your `.env` exists.
5. **Seed development data (optional)**
   - Use the MongoDB shell or a script under `apps/worker` to insert seed consultants, skills, and taxonomy entries for richer local testing.
6. **Verify flows**
   - Create a test account, upload a CV, and confirm the document appears in your S3 bucket/emulator.
   - Check the worker logs to ensure background jobs (e.g., virus scanning stubs) process the upload events without errors.

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
