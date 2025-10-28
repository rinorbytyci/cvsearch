"use client";

import { useEffect } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";

import type { RegisterActionState } from "./actions";
import { registerAction } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="w-full rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
      disabled={pending}
    >
      {pending ? "Creating account..." : "Create account"}
    </button>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? undefined;
  const [state, formAction] = useFormState<RegisterActionState, FormData>(registerAction, {
    success: false
  });

  useEffect(() => {
    if (state.success && !state.totpSecret) {
      router.push(redirectTo ?? "/");
    }
  }, [state.success, state.totpSecret, router, redirectTo]);

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded border border-gray-200 p-6 shadow-sm">
      <input name="redirectTo" type="hidden" value={redirectTo ?? ""} />
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium" htmlFor="name">
          Full name
        </label>
        <input id="name" name="name" type="text" className="rounded border border-gray-300 px-3 py-2" />
        {state.fieldErrors?.name ? <p className="text-sm text-red-600">{state.fieldErrors.name}</p> : null}
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium" htmlFor="email">
          Email
        </label>
        <input id="email" name="email" type="email" required className="rounded border border-gray-300 px-3 py-2" />
        {state.fieldErrors?.email ? <p className="text-sm text-red-600">{state.fieldErrors.email}</p> : null}
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium" htmlFor="password">
          Password
        </label>
        <input id="password" name="password" type="password" required className="rounded border border-gray-300 px-3 py-2" />
        {state.fieldErrors?.password ? <p className="text-sm text-red-600">{state.fieldErrors.password}</p> : null}
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium" htmlFor="confirmPassword">
          Confirm password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          className="rounded border border-gray-300 px-3 py-2"
        />
        {state.fieldErrors?.confirmPassword ? (
          <p className="text-sm text-red-600">{state.fieldErrors.confirmPassword}</p>
        ) : null}
      </div>
      <div className="flex items-start gap-3 rounded border border-gray-200 p-3">
        <input id="enableTotp" name="enableTotp" type="checkbox" value="on" className="mt-1" />
        <div>
          <label className="text-sm font-medium" htmlFor="enableTotp">
            Enable authenticator app security
          </label>
          <p className="text-xs text-gray-500">
            We&apos;ll generate a TOTP secret for you to add to your authenticator app after registration.
          </p>
        </div>
      </div>
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state.success && state.totpSecret ? (
        <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          <p className="font-medium">Authenticator setup</p>
          <p>
            Add this secret to your authenticator app: <code className="font-mono">{state.totpSecret}</code>
          </p>
        </div>
      ) : null}
      <SubmitButton />
    </form>
  );
}
