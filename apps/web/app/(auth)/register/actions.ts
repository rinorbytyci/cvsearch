"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { authenticator } from "otplib";
import { z } from "zod";

import { signIn } from "@/app/api/auth/[...nextauth]/route";
import { usersCollection } from "@/lib/db/collections";

const registerSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    email: z.string().email(),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8, "Password confirmation is required"),
    enableTotp: z.union([z.literal("on"), z.literal("off")]).optional(),
    redirectTo: z.string().optional()
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"]
  });

export interface RegisterActionState {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  totpSecret?: string | null;
}

export async function registerAction(
  prevState: RegisterActionState | undefined,
  formData: FormData
): Promise<RegisterActionState> {
  const nameValue = formData.get("name");
  const enableTotpValue = formData.get("enableTotp");
  const redirectToValue = formData.get("redirectTo");
  const parsed = registerSchema.safeParse({
    name: typeof nameValue === "string" && nameValue.trim().length > 0 ? nameValue.trim() : undefined,
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    enableTotp: typeof enableTotpValue === "string" ? enableTotpValue : undefined,
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

  const { name, email, password, enableTotp, redirectTo } = parsed.data;
  const emailLower = email.toLowerCase();
  const users = await usersCollection();
  const existing = await users.findOne({ email: emailLower });

  if (existing) {
    return { success: false, error: "An account with that email already exists." };
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const enableTotpBoolean = enableTotp === "on";
  const totpSecret = enableTotpBoolean ? authenticator.generateSecret() : null;

  const now = new Date();
  const insertResult = await users.insertOne({
    email: emailLower,
    name: name ?? null,
    passwordHash,
    role: "user",
    permissions: [],
    totpSecret,
    emailVerified: null,
    createdAt: now,
    updatedAt: now
  });

  if (!insertResult.acknowledged) {
    return { success: false, error: "Unable to create account. Please try again." };
  }

  try {
    await signIn("credentials", {
      email: emailLower,
      password,
      redirect: false
    });
  } catch (error) {
    if (!(error instanceof AuthError && error.type === "CredentialsSignin")) {
      return {
        success: false,
        error: "Account created but automatic sign-in failed. Please sign in manually.",
        totpSecret
      };
    }
  }

  if (redirectTo && !totpSecret) {
    redirect(redirectTo);
  }

  return { success: true, totpSecret };
}
