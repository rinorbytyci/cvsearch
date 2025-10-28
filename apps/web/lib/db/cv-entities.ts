import type { Document, ObjectId } from "mongodb";

import { getDatabase } from "./client";

export type CvEntityType = "education" | "experience" | "skill" | "language" | "certification" | "summary";
export type CvEntitySource = "parser" | "manual";

export interface CvEntityDocument extends Document {
  _id?: ObjectId;
  cvId: ObjectId;
  versionId: ObjectId;
  entityType: CvEntityType;
  label: string;
  confidence: number;
  source: CvEntitySource;
  metadata?: Record<string, unknown>;
  embedding?: number[];
  createdAt: Date;
  updatedAt: Date;
}

export async function cvEntitiesCollection() {
  const db = await getDatabase();
  return db.collection<CvEntityDocument>("cv_entities");
}
