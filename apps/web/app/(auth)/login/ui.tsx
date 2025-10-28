"use client";

import { useEffect } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";

import type { LoginActionState } from "./actions";
import { loginAction } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="w-full rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
      disabled={pending}
    >
      {pending ? "Signing in..." : "Sign in"}
    </button>
  );
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? undefined;
  const [state, formAction] = useFormState<LoginActionState, FormData>(loginAction, {
    success: false
  });

  useEffect(() => {
    if (state.success) {
      router.push(redirectTo ?? "/");
    }
  }, [state.success, router, redirectTo]);

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded border border-gray-200 p-6 shadow-sm">
      <input name="redirectTo" type="hidden" value={redirectTo ?? ""} />
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="rounded border border-gray-300 px-3 py-2"
        />
        {state.fieldErrors?.email ? <p className="text-sm text-red-600">{state.fieldErrors.email}</p> : null}
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          className="rounded border border-gray-300 px-3 py-2"
        />
        {state.fieldErrors?.password ? <p className="text-sm text-red-600">{state.fieldErrors.password}</p> : null}
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium" htmlFor="totp">
          Authenticator code
        </label>
        <input
          id="totp"
          name="totp"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          className="rounded border border-gray-300 px-3 py-2"
          placeholder="123456"
        />
      </div>
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <SubmitButton />
    </form>
  );
}
