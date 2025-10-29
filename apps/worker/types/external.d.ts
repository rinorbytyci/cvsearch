declare module "@aws-sdk/client-s3" {
  export interface S3ClientConfig {
    region?: string;
    credentials?: {
      accessKeyId: string;
      secretAccessKey: string;
    };
  }

  export interface GetObjectCommandInput {
    Bucket?: string;
    Key?: string;
    [key: string]: unknown;
  }

  export interface GetObjectCommandOutput {
    Body?: unknown;
    [key: string]: unknown;
  }

  export class GetObjectCommand {
    constructor(input: GetObjectCommandInput);
    readonly input: GetObjectCommandInput;
  }

  export class S3Client {
    constructor(config?: S3ClientConfig);
    send<TOutput = GetObjectCommandOutput>(command: { input: GetObjectCommandInput }): Promise<TOutput>;
  }
}

declare module "textract" {
  export type TextractCallback = (error: Error | null, text?: string | null) => void;

  export interface TextractOptions {
    [key: string]: unknown;
  }

  export function fromBufferWithMime(
    mimeType: string,
    data: Buffer,
    callback: TextractCallback
  ): void;
  export function fromBufferWithMime(
    mimeType: string,
    data: Buffer,
    options: TextractOptions,
    callback: TextractCallback
  ): void;

  interface TextractModule {
    fromBufferWithMime: typeof fromBufferWithMime;
  }

  const textract: TextractModule;
  export = textract;
}
