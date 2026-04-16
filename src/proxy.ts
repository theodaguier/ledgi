import type { NextRequest } from "next/server";

export function proxy(_request: NextRequest) {
  return;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};