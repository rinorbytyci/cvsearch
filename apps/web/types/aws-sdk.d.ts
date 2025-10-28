declare module "@aws-sdk/client-s3" {
  export interface S3ClientConfig {
    region?: string;
    credentials?: {
      accessKeyId: string;
      secretAccessKey: string;
      sessionToken?: string;
    };
  }

  export class S3Client {
    constructor(config?: S3ClientConfig);
    destroy(): void;
  }
}

declare module "@aws-sdk/lib-storage" {
  import type { S3Client } from "@aws-sdk/client-s3";

  export interface UploadParams {
    Bucket: string;
    Key: string;
    Body: any;
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

  export class Upload {
    constructor(options: UploadOptions);
    done(): Promise<void>;
  }
}
