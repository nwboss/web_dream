declare module "@volcengine/openapi" {
  export class Signer {
    constructor(request: {
      region: string;
      method: string;
      params?: Record<string, string>;
      headers?: Record<string, string>;
      body?: string;
    }, service: string);

    addAuthorization(credentials: {
      accessKeyId: string;
      secretKey: string;
      sessionToken?: string;
    }): void;
  }
}
