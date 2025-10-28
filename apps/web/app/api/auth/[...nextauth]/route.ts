import NextAuth from "next-auth";
import type { User as NextAuthUser } from "next-auth";
import type { Adapter } from "next-auth/adapters";
import CredentialsProvider from "next-auth/providers/credentials";
import GitHubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import { authenticator } from "otplib";
import { z } from "zod";

import { getClient } from "@/lib/db/client";
import { usersCollection } from "@/lib/db/collections";
import { logAuditEvent } from "@/app/api/middleware/audit";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  totp: z.string().optional()
});

const baseAdapter = MongoDBAdapter(getClient(), {
    collections: {
      Users: "users",
      Accounts: "accounts",
      Sessions: "sessions",
      VerificationTokens: "verificationTokens"
    }
  });

const adapter: Adapter = {
  ...baseAdapter,
  async createVerificationToken(token) {
    if (!baseAdapter.createVerificationToken) {
      throw new Error("Verification tokens are not supported by the adapter.");
    }
    const created = await baseAdapter.createVerificationToken(token);
    await logAuditEvent({
      type: "password_reset",
      success: true,
      email: created.identifier,
      metadata: {
        action: "create",
        token: created.token
      }
    });
    return created;
  },
  async useVerificationToken(params) {
    if (!baseAdapter.useVerificationToken) {
      throw new Error("Verification tokens are not supported by the adapter.");
    }
    const result = await baseAdapter.useVerificationToken(params);
    if (result) {
      await logAuditEvent({
        type: "password_reset",
        success: true,
        email: result.identifier,
        metadata: {
          action: "use",
          token: result.token
        }
      });
    }
    return result;
  }
};

const handler = NextAuth({
  adapter,
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "database"
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        totp: { label: "Authenticator Code", type: "text", optional: true }
      },
      async authorize(rawCredentials) {
        const attemptedEmail =
          rawCredentials && typeof rawCredentials.email === "string"
            ? rawCredentials.email
            : undefined;
        const parseResult = credentialsSchema.safeParse(rawCredentials);

        if (!parseResult.success) {
          await logAuditEvent({
            type: "login",
            success: false,
            email: attemptedEmail,
            message: "Invalid credential payload"
          });
          return null;
        }

        const { email, password, totp } = parseResult.data;
        const users = await usersCollection();
        const user = await users.findOne({ email: email.toLowerCase() });

        if (!user || !user._id) {
          await logAuditEvent({
            type: "login",
            success: false,
            email,
            message: "User not found"
          });
          return null;
        }

        const passwordMatches = await bcrypt.compare(password, user.passwordHash);

        if (!passwordMatches) {
          await logAuditEvent({
            type: "login",
            success: false,
            userId: user._id,
            email,
            message: "Invalid password"
          });
          return null;
        }

        if (user.totpSecret) {
          if (!totp || !authenticator.check(totp, user.totpSecret)) {
            await logAuditEvent({
              type: "login",
              success: false,
              userId: user._id,
              email,
              message: "Invalid TOTP token"
            });
            return null;
          }
        }

        await logAuditEvent({
          type: "login",
          success: true,
          userId: user._id,
          email
        });

        const authUser: NextAuthUser = {
          id: user._id.toHexString(),
          email: user.email,
          name: user.name ?? null,
          role: user.role,
          permissions: user.permissions
        };

        return authUser;
      }
    }),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET
          })
        ]
      : []),
    ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
      ? [
          GitHubProvider({
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET
          })
        ]
      : [])
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.permissions = user.permissions;
      }
      return token;
    },
    async session({ session, token, user }) {
      if (session.user) {
        if (user) {
          session.user.role = user.role;
          session.user.permissions = user.permissions;
          session.user.id = user.id ?? session.user.id;
        } else if (token) {
          session.user.role = token.role;
          session.user.permissions = token.permissions;
          session.user.id = token.sub ?? session.user.id;
        }
      }
      return session;
    }
  },
  events: {
    async signOut(message) {
      const session = "session" in message ? message.session : undefined;
      if (session?.user) {
        await logAuditEvent({
          type: "session_revocation",
          success: true,
          userId: session.user.id,
          email: session.user.email ?? undefined
        });
      }
    }
  }
});

export const { handlers, auth, signIn, signOut } = handler;
export const { GET, POST } = handlers;
