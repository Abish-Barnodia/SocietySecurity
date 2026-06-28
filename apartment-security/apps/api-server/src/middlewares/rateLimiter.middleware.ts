import rateLimit from 'express-rate-limit';

export const globalRateLimiter = rateLimit({
  max: 1000,
  windowMs: 60 * 60 * 1000, // 1 hour
  message: 'Too many requests from this IP, please try again in an hour!',
});

export const authRateLimiter = rateLimit({
  max: 20, // Limit each IP to 20 auth requests per `window` (here, per 15 minutes)
  windowMs: 15 * 60 * 1000,
  message: 'Too many login attempts from this IP, please try again after 15 minutes',
});
