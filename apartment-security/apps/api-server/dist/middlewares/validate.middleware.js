"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = void 0;
const zod_1 = require("zod");
const validate = (schema) => {
    return async (req, res, next) => {
        try {
            const parsed = await schema.parseAsync({
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
        }
        catch (error) {
            if (error instanceof zod_1.ZodError) {
                // Pass to error handler
                return next(error);
            }
            return next(error);
        }
    };
};
exports.validate = validate;
//# sourceMappingURL=validate.middleware.js.map