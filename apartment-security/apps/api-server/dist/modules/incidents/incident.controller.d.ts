import { Request, Response, NextFunction } from 'express';
export declare const createIncident: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const assignIncident: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const escalateIncident: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const closeIncident: (req: Request, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=incident.controller.d.ts.map