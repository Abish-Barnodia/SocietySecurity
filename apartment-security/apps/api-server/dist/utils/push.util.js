"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPush = void 0;
const app_1 = require("firebase-admin/app");
const messaging_1 = require("firebase-admin/messaging");
const env_1 = require("../config/env");
const logger_util_1 = require("./logger.util");
// Only initialize if we have the credentials (prevents crash in local dev without keys)
if (env_1.env.FIREBASE_PROJECT_ID && env_1.env.FIREBASE_CLIENT_EMAIL && env_1.env.FIREBASE_PRIVATE_KEY) {
    (0, app_1.initializeApp)({
        credential: (0, app_1.cert)({
            projectId: env_1.env.FIREBASE_PROJECT_ID,
            clientEmail: env_1.env.FIREBASE_CLIENT_EMAIL,
            privateKey: env_1.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
    });
}
const sendPush = async (tokens, payload) => {
    if (!tokens.length)
        return;
    if (!(0, app_1.getApps)().length) {
        logger_util_1.logger.warn('Firebase admin not initialized, skipping push notification', payload);
        return;
    }
    // FCM allows max 500 tokens per multicast
    const chunks = chunkArray(tokens, 500);
    for (const chunk of chunks) {
        try {
            const response = await (0, messaging_1.getMessaging)().sendEachForMulticast({
                tokens: chunk,
                notification: { title: payload.title, body: payload.body },
                data: payload.data ?? {},
                android: { priority: 'high' },
                apns: { payload: { aps: { sound: 'default', badge: 1 } } },
            });
            // Remove invalid tokens from DB
            const invalidTokens = [];
            response.responses.forEach((r, i) => {
                if (!r.success && r.error?.code === 'messaging/registration-token-not-registered') {
                    invalidTokens.push(chunk[i]);
                }
            });
            if (invalidTokens.length) {
                await cleanInvalidTokens(invalidTokens);
            }
        }
        catch (err) {
            logger_util_1.logger.error('FCM send error', { err });
        }
    }
};
exports.sendPush = sendPush;
const cleanInvalidTokens = async (tokens) => {
    const { prisma } = await Promise.resolve().then(() => __importStar(require('../config/prisma')));
    const users = await prisma.user.findMany({
        where: { fcmTokens: { hasSome: tokens } },
        select: { id: true, fcmTokens: true },
    });
    for (const user of users) {
        const cleaned = user.fcmTokens.filter((t) => !tokens.includes(t));
        await prisma.user.update({
            where: { id: user.id },
            data: { fcmTokens: cleaned },
        });
    }
};
const chunkArray = (arr, size) => {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size)
        chunks.push(arr.slice(i, i + size));
    return chunks;
};
//# sourceMappingURL=push.util.js.map