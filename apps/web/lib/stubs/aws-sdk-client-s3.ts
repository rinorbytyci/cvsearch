export interface S3ClientConfig {
  region?: string;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
  };
}

export class S3Client {
  readonly config: S3ClientConfig | undefined;

  constructor(config?: S3ClientConfig) {
    this.config = config;
  }

  // Provided for API parity with the AWS SDK client interface.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  destroy(): void {}
}
