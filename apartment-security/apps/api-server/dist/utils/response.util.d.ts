import { Response } from 'express';
export declare const sendSuccess: (res: Response, statusCode: number, message: string, data?: any) => Response<any, Record<string, any>>;
export declare const sendError: (res: Response, statusCode: number, message: string, errors?: any) => Response<any, Record<string, any>>;
//# sourceMappingURL=response.util.d.ts.map