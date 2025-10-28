import { MongoClient } from "mongodb";
import { getEnv } from "@/config/env";

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

let clientPromise: Promise<MongoClient> | undefined;

function createClientPromise() {
  const { MONGODB_URI } = getEnv();
  const client = new MongoClient(MONGODB_URI);
  return client.connect();
}

export function getClient() {
  if (process.env.NODE_ENV === "development") {
    if (!global._mongoClientPromise) {
      global._mongoClientPromise = createClientPromise();
    }

    return global._mongoClientPromise;
  }

  if (!clientPromise) {
    clientPromise = createClientPromise();
  }

  return clientPromise;
}

export async function getDatabase() {
  const client = await getClient();
  return client.db();
}
