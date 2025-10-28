import { authHandler } from "@/lib/auth/nextauth";

export const GET = authHandler.handlers.GET;
export const POST = authHandler.handlers.POST;
