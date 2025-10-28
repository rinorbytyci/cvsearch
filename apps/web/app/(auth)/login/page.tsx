import Link from "next/link";

import type { Route } from "next";

import { LoginForm } from "./ui";

type LoginPageProps = {
  searchParams?: {
    redirectTo?: string;
  };
};

function resolveRedirect(redirectTo?: string): Route | null {
  if (!redirectTo) {
    return null;
  }

  return redirectTo.startsWith("/") ? (redirectTo as Route) : null;
}

export default function LoginPage({ searchParams }: LoginPageProps) {
  const redirectRoute = resolveRedirect(searchParams?.redirectTo);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 py-16">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold">Sign in to your account</h1>
        <p className="text-sm text-gray-500">
          Enter your email, password, and authenticator code if enabled.
        </p>
      </div>
      <LoginForm redirectRoute={redirectRoute ?? undefined} />
      <p className="text-center text-sm text-gray-500">
        Don&apos;t have an account?{" "}
        <Link className="text-blue-600 underline" href="/register">
          Create one now
        </Link>
        .
      </p>
    </div>
  );
}
