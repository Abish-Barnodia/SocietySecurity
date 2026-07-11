"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rotateRefreshToken = exports.verifyRefreshToken = exports.verifyAccessToken = exports.signRefreshToken = exports.signAccessToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const signAccessToken = (payload) => {
    return jsonwebtoken_1.default.sign(payload, env_1.env.JWT_SECRET, {
        expiresIn: env_1.env.JWT_EXPIRES_IN,
    });
};
exports.signAccessToken = signAccessToken;
const signRefreshToken = (payload) => {
    return jsonwebtoken_1.default.sign(payload, env_1.env.JWT_REFRESH_SECRET, {
        expiresIn: env_1.env.JWT_REFRESH_EXPIRES_IN,
    });
};
exports.signRefreshToken = signRefreshToken;
const verifyAccessToken = (token) => {
    return jsonwebtoken_1.default.verify(token, env_1.env.JWT_SECRET);
};
exports.verifyAccessToken = verifyAccessToken;
const verifyRefreshToken = (token) => {
    return jsonwebtoken_1.default.verify(token, env_1.env.JWT_REFRESH_SECRET);
};
exports.verifyRefreshToken = verifyRefreshToken;
// rotateRefreshToken verifies the old token and issues a new signed one.
// The DB revocation of the old token happens in auth.controller.ts inside a transaction.
const rotateRefreshToken = async (oldToken) => {
    const { iat, exp, ...decoded } = (0, exports.verifyRefreshToken)(oldToken);
    return (0, exports.signRefreshToken)(decoded);
};
exports.rotateRefreshToken = rotateRefreshToken;
//# sourceMappingURL=jwt.util.js.map