"use server";

import type { Route } from "next";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { z } from "zod";

import { signIn } from "@/lib/auth/nextauth";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
  totp: z.string().optional(),
  redirectTo: z.string().startsWith("/", { message: "Redirect must be an internal path" }).optional()
});

export interface LoginActionState {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function loginAction(prevState: LoginActionState | undefined, formData: FormData): Promise<LoginActionState> {
  const totpValue = formData.get("totp");
  const redirectToValue = formData.get("redirectTo");
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    totp: typeof totpValue === "string" && totpValue.trim().length > 0 ? totpValue.trim() : undefined,
    redirectTo:
      typeof redirectToValue === "string" && redirectToValue.trim().length > 0
        ? redirectToValue.trim()
        : undefined
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(fieldErrors)) {
      if (value && value.length > 0) {
        normalized[key] = value[0] ?? "Invalid value";
      }
    }

    return {
      success: false,
      error: "Please correct the highlighted fields.",
      fieldErrors: normalized
    };
  }

  const { email, password, totp, redirectTo } = parsed.data;
  const redirectRoute = redirectTo ? (redirectTo as Route) : undefined;

  try {
    await signIn("credentials", {
      email,
      password,
      totp,
      redirect: false
    });
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return { success: false, error: "Invalid email, password, or TOTP code." };
        default:
          return { success: false, error: "Unable to sign in right now. Please try again." };
      }
    }

    return { success: false, error: "Unexpected error occurred." };
  }

  if (redirectRoute) {
    redirect(redirectRoute);
  }

  return { success: true };
}
