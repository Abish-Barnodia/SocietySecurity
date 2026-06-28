"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFoundHandler = void 0;
const error_middleware_1 = require("./error.middleware");
const notFoundHandler = (req, res, next) => {
    next(new error_middleware_1.AppError(`Can't find ${req.originalUrl} on this server!`, 404));
};
exports.notFoundHandler = notFoundHandler;
//# sourceMappingURL=notFound.middleware.js.map