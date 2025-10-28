import { MongoClient } from "mongodb";
import { getEnv } from "@/config/env";

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

const env = getEnv();
const uri = env.MONGODB_URI;

let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === "development") {
  if (!global._mongoClientPromise) {
    const client = new MongoClient(uri);
    global._mongoClientPromise = client.connect();
  }

  clientPromise = global._mongoClientPromise;
} else {
  const client = new MongoClient(uri);
  clientPromise = client.connect();
}

export function getClient() {
  return clientPromise;
}

export async function getDatabase() {
  const client = await getClient();
  return client.db();
}
