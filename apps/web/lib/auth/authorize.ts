import type { Session } from "next-auth";
import { NextResponse } from "next/server";

import { auth } from "@/app/api/auth/[...nextauth]/route";

export interface AuthorizationOptions {
  roles?: string[];
  permissions?: string[];
}

export type AuthorizedHandler<T> = (session: Session) => Promise<T> | T;

export async function authorize<T>(
  options: AuthorizationOptions,
  handler: AuthorizedHandler<T>
): Promise<T | Response> {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = session.user.role ?? null;
  const userPermissions = session.user.permissions ?? [];

  if (options.roles?.length) {
    if (!userRole || !options.roles.includes(userRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  if (options.permissions?.length) {
    const missing = options.permissions.filter((permission) => !userPermissions.includes(permission));
    if (missing.length > 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  return handler(session);
}
