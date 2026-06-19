import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { updateSession } from "./lib/supabase/proxy";

const publicRoutes = new Set([
  "/auth/callback",
  "/cadastro",
  "/login",
  "/nova-senha",
  "/recuperar-senha"
]);

export async function proxy(request: NextRequest) {
  const response = await updateSession(request);
  const path = request.nextUrl.pathname;

  if (publicRoutes.has(path)) {
    return response;
  }

  const hasAuthCookie = request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("auth-token"));

  if (!hasAuthCookie) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", path);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]
};
