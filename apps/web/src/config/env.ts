import path from "node:path";
import { loadEnv, type AppEnv } from "@cvsearch/config";

let cachedEnv: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (!cachedEnv) {
    const envPath = path.resolve(process.cwd(), ".env");
    cachedEnv = loadEnv({ path: envPath });
  }

  return cachedEnv;
}
