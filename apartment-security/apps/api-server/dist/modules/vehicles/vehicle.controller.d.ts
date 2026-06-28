import { Request, Response, NextFunction } from 'express';
export declare const registerVehicle: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const checkVehicle: (req: Request, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
//# sourceMappingURL=vehicle.controller.d.ts.map