import { config as loadDotenv } from "dotenv";
import { z } from "zod";

const mongodbUriSchema = z
  .string()
  .min(1, "MONGODB_URI is required")
  .refine((value) => /^mongodb(\+srv)?:\/\/.+/.test(value), {
    message: "MONGODB_URI must be a valid MongoDB connection string"
  });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  MONGODB_URI: mongodbUriSchema,
  S3_ACCESS_KEY_ID: z.string().min(1, "S3_ACCESS_KEY_ID is required"),
  S3_SECRET_ACCESS_KEY: z.string().min(1, "S3_SECRET_ACCESS_KEY is required"),
  S3_REGION: z.string().min(1, "S3_REGION is required"),
  S3_BUCKET: z.string().min(1, "S3_BUCKET is required"),
  ATLAS_SEARCH_INDEX_NAME: z.string().optional(),
  ATLAS_SEARCH_VECTOR_INDEX: z.string().optional(),
  OPENSEARCH_HOST: z.string().optional(),
  OPENSEARCH_API_KEY: z.string().optional(),
  CV_EMBEDDINGS_COLLECTION: z.string().optional()
});

export type AppEnv = z.infer<typeof envSchema>;

export function loadEnv(options?: { path?: string }) {
  if (options?.path) {
    loadDotenv({ path: options.path });
  } else {
    loadDotenv();
  }

  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const formatted = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${formatted}`);
  }

  return parsed.data;
}

export const env = (() => {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    return undefined;
  }

  return parsed.data;
})();
