import NextAuth from "next-auth";
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

const optionalProviders: Array<ReturnType<typeof GoogleProvider>> = [];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  optionalProviders.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET
    })
  );
}

if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  optionalProviders.push(
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET
    })
  );
}

const handler = NextAuth({
  adapter: MongoDBAdapter(getClient(), {
    collections: {
      Users: "users",
      Accounts: "accounts",
      Sessions: "sessions",
      VerificationTokens: "verificationTokens"
    }
  }),
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
        const parseResult = credentialsSchema.safeParse(rawCredentials);

        if (!parseResult.success) {
          await logAuditEvent({
            type: "login",
            success: false,
            email: rawCredentials?.email,
            message: "Invalid credential payload"
          });
          return null;
        }

        const { email, password, totp } = parseResult.data;
        const users = await usersCollection();
        const user = await users.findOne({ email: email.toLowerCase() });

        if (!user) {
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

        return {
          id: user._id.toHexString(),
          email: user.email,
          name: user.name ?? null,
          role: user.role,
          permissions: user.permissions
        } as any;
      }
    }),
    ...optionalProviders
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.permissions = (user as any).permissions;
      }
      return token;
    },
    async session({ session, token, user }) {
      if (session.user) {
        if (user) {
          session.user.role = (user as any).role;
          session.user.permissions = (user as any).permissions;
          session.user.id = user.id;
        } else if (token) {
          session.user.role = token.role as string | undefined;
          session.user.permissions = token.permissions as string[] | undefined;
          session.user.id = token.sub as string | undefined;
        }
      }
      return session;
    }
  },
  events: {
    async signOut(message) {
      if (message.session?.user) {
        await logAuditEvent({
          type: "session_revocation",
          success: true,
          userId: message.session.user.id,
          email: message.session.user.email ?? undefined,
          metadata: {
            trigger: message.trigger
          }
        });
      }
    },
    async createVerificationToken(message) {
      await logAuditEvent({
        type: "password_reset",
        success: true,
        email: message.identifier,
        metadata: {
          action: "create",
          token: message.token
        }
      });
    },
    async useVerificationToken(message) {
      await logAuditEvent({
        type: "password_reset",
        success: true,
        email: message.identifier,
        metadata: {
          action: "use",
          token: message.token
        }
      });
    }
  }
});

export const { handlers, auth, signIn, signOut } = handler;
export const { GET, POST } = handlers;
