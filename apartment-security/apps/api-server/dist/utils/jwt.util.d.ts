export interface TokenPayload {
    userId: string;
    role: string;
    guardId?: string;
    propertyId?: string;
    residentId?: string;
}
export declare const signAccessToken: (payload: TokenPayload) => string;
export declare const signRefreshToken: (payload: TokenPayload) => string;
export declare const verifyAccessToken: (token: string) => TokenPayload;
export declare const verifyRefreshToken: (token: string) => TokenPayload;
export declare const rotateRefreshToken: (oldToken: string) => Promise<string>;
//# sourceMappingURL=jwt.util.d.ts.map