import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export const validate = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed: any = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      if (parsed.body !== undefined) {
        req.body = parsed.body;
      }
      if (parsed.query !== undefined) {
        Object.keys(req.query).forEach(key => delete req.query[key]);
        Object.assign(req.query, parsed.query);
      }
      if (parsed.params !== undefined) {
        Object.keys(req.params).forEach(key => delete req.params[key]);
        Object.assign(req.params, parsed.params);
      }
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Pass to error handler
        return next(error);
      }
      return next(error);
    }
  };
};
