import Link from "next/link";

import type { Route } from "next";

import { RegisterForm } from "./ui";

type RegisterPageProps = {
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

export default function RegisterPage({ searchParams }: RegisterPageProps) {
  const redirectRoute = resolveRedirect(searchParams?.redirectTo);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 py-16">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold">Create a new account</h1>
        <p className="text-sm text-gray-500">
          Sign up to manage your resumes and enable multi-factor authentication.
        </p>
      </div>
      <RegisterForm redirectRoute={redirectRoute ?? undefined} />
      <p className="text-center text-sm text-gray-500">
        Already have an account?{" "}
        <Link className="text-blue-600 underline" href="/login">
          Sign in instead
        </Link>
        .
      </p>
    </div>
  );
}
