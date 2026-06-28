import { Request, Response, NextFunction } from 'express';
export declare const syncOfflineEntries: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const getPassCache: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=offline.controller.d.ts.map