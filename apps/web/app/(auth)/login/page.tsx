import Link from "next/link";

import { LoginForm } from "./ui";

export default function LoginPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 py-16">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold">Sign in to your account</h1>
        <p className="text-sm text-gray-500">
          Enter your email, password, and authenticator code if enabled.
        </p>
      </div>
      <LoginForm />
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
