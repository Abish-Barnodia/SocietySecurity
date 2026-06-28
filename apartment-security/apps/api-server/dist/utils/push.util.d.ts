interface PushPayload {
    title: string;
    body: string;
    data?: Record<string, string>;
}
export declare const sendPush: (tokens: string[], payload: PushPayload) => Promise<void>;
export {};
//# sourceMappingURL=push.util.d.ts.map