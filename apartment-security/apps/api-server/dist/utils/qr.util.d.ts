export interface QRPayload {
    passId: string;
    visitorName: string;
    validFrom: number;
    validUntil: number;
}
export declare const generateSignedQRPayload: (payload: QRPayload) => string;
export declare const verifySignedQRPayload: (signedPayload: string) => QRPayload | null;
//# sourceMappingURL=qr.util.d.ts.map