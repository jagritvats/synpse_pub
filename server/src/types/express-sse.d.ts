declare module "express-sse" {
  import { Request, Response } from "express";

  export default class SSE {
    constructor(initial?: any, options?: any);
    init(req: Request, res: Response): void;
    send(data: any, event?: string): void;
    updateInit(data: any): void;
    serialize(data: any): string;
    close(): void;
  }
}
