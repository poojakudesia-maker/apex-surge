import { HttpsError, CallableRequest } from "firebase-functions/v2/https";

export function requireAuth(request: CallableRequest): string {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }
  return request.auth.uid;
}

export function todayId(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

export function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}
