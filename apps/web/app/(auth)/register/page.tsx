import Link from "next/link";

import { RegisterForm } from "./ui";

export default function RegisterPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 py-16">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold">Create a new account</h1>
        <p className="text-sm text-gray-500">
          Sign up to manage your resumes and enable multi-factor authentication.
        </p>
      </div>
      <RegisterForm />
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
