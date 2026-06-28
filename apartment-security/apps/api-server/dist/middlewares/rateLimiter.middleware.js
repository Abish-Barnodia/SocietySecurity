"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRateLimiter = exports.globalRateLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
exports.globalRateLimiter = (0, express_rate_limit_1.default)({
    max: 1000,
    windowMs: 60 * 60 * 1000, // 1 hour
    message: 'Too many requests from this IP, please try again in an hour!',
});
exports.authRateLimiter = (0, express_rate_limit_1.default)({
    max: 20, // Limit each IP to 20 auth requests per `window` (here, per 15 minutes)
    windowMs: 15 * 60 * 1000,
    message: 'Too many login attempts from this IP, please try again after 15 minutes',
});
//# sourceMappingURL=rateLimiter.middleware.js.map