"use client";

import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL ?? "http://localhost:3000",
});

export const { signOut, useSession, getSession } = authClient;

export async function signInWithEmail(email: string, password: string) {
  return authClient.signIn.email({ email, password });
}