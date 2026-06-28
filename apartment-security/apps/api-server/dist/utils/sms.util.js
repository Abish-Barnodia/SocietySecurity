"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendSMS = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const env_1 = require("../config/env");
const logger_util_1 = require("./logger.util");
const prisma_1 = require("../config/prisma");
const transporter = nodemailer_1.default.createTransport({
    service: 'gmail',
    auth: {
        user: env_1.env.SMTP_USER,
        pass: env_1.env.SMTP_PASS,
    },
});
const sendSMS = async (to, body) => {
    try {
        if (env_1.env.NODE_ENV === 'test')
            return;
        if (env_1.env.SMTP_USER && env_1.env.SMTP_PASS) {
            // Find the user by phone number to get their email address
            const user = await prisma_1.prisma.user.findUnique({ where: { phone: to } });
            // If user has no email, fallback to sending the email to the SMTP_USER itself for testing
            const targetEmail = user?.email || env_1.env.SMTP_USER;
            await transporter.sendMail({
                from: `"Apartment Security" <${env_1.env.SMTP_USER}>`,
                to: targetEmail,
                subject: 'Security Alert / OTP',
                text: `(This message was originally an SMS intended for ${to})\n\n${body}`,
            });
            logger_util_1.logger.info(`📧 Email successfully sent to ${targetEmail} in place of SMS.`);
        }
        else {
            // MOCK MODE: Print to terminal instead of sending anything
            logger_util_1.logger.info(`\n📱 [MOCK SMS to ${to}]:\n${body}\n`);
        }
    }
    catch (err) {
        logger_util_1.logger.error('Message send failed', { to, err });
        // Do not throw — failure should never crash the main flow
    }
};
exports.sendSMS = sendSMS;
//# sourceMappingURL=sms.util.js.map