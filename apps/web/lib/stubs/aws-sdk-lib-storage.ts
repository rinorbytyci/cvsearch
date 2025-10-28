import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import type { S3Client } from "./aws-sdk-client-s3";

export interface UploadParams {
  Bucket: string;
  Key: string;
  Body: AsyncIterable<Uint8Array> | NodeJS.ReadableStream | Buffer | string;
  ContentType?: string;
  Metadata?: Record<string, string | undefined>;
}

export interface UploadOptions {
  client: S3Client;
  params: UploadParams;
  queueSize?: number;
  partSize?: number;
  leavePartsOnError?: boolean;
}

async function writeStream(targetPath: string, body: UploadParams["Body"]): Promise<void> {
  if (Buffer.isBuffer(body) || typeof body === "string") {
    const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body);
    await mkdir(dirname(targetPath), { recursive: true });
    await pipeline(
      Readable.from(buffer),
      createWriteStream(targetPath)
    );
    return;
  }

  const stream = body as NodeJS.ReadableStream;
  if (stream && typeof stream.pipe === "function") {
    await mkdir(dirname(targetPath), { recursive: true });
    await pipeline(stream, createWriteStream(targetPath));
    return;
  }

  if (body && typeof (body as AsyncIterable<Uint8Array>)[Symbol.asyncIterator] === "function") {
    await mkdir(dirname(targetPath), { recursive: true });
    await pipeline(Readable.from(body as AsyncIterable<Uint8Array>), createWriteStream(targetPath));
    return;
  }

  throw new Error("Unsupported upload body type");
}

const STORAGE_ROOT = process.env.CV_STORAGE_ROOT ?? join(process.cwd(), ".next", "cache", "cv-uploads");

export class Upload {
  private readonly options: UploadOptions;

  constructor(options: UploadOptions) {
    this.options = options;
  }

  async done(): Promise<void> {
    const { params } = this.options;
    const bucketRoot = join(STORAGE_ROOT, params.Bucket);
    const targetPath = join(bucketRoot, params.Key);
    await writeStream(targetPath, params.Body);
  }
}
