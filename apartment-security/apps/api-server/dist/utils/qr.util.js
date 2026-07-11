"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifySignedQRPayload = exports.generateSignedQRPayload = void 0;
const crypto_1 = __importDefault(require("crypto"));
const env_1 = require("../config/env");
const generateSignedQRPayload = (payload) => {
    const dataString = JSON.stringify(payload);
    const signature = crypto_1.default
        .createHmac('sha256', env_1.env.QR_HMAC_SECRET)
        .update(dataString)
        .digest('hex');
    // Payload structure: Base64(JSON).Signature
    const base64Data = Buffer.from(dataString).toString('base64');
    return `${base64Data}.${signature}`;
};
exports.generateSignedQRPayload = generateSignedQRPayload;
const verifySignedQRPayload = (signedPayload) => {
    const parts = signedPayload.split('.');
    if (parts.length !== 2)
        return null;
    const [base64Data, signature] = parts;
    const dataString = Buffer.from(base64Data, 'base64').toString('utf8');
    const expectedSignature = crypto_1.default
        .createHmac('sha256', env_1.env.QR_HMAC_SECRET)
        .update(dataString)
        .digest('hex');
    const signatureBuffer = Buffer.from(signature);
    const expectedSignatureBuffer = Buffer.from(expectedSignature);
    if (signatureBuffer.length !== expectedSignatureBuffer.length || !crypto_1.default.timingSafeEqual(signatureBuffer, expectedSignatureBuffer)) {
        return null; // Signature mismatch, tampered QR
    }
    try {
        return JSON.parse(dataString);
    }
    catch (error) {
        return null;
    }
};
exports.verifySignedQRPayload = verifySignedQRPayload;
//# sourceMappingURL=qr.util.js.map