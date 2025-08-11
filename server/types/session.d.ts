import 'express-session';

declare module 'express-session' {
  interface SessionData {
    impersonation?: {
      adminId: string;
      targetUserId: string;
      startedAt: string;
    };
  }
}