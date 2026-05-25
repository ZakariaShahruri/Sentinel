import { NextRequest, NextResponse } from "next/server";

function decodeJwtPayload(token: string): { role?: string } | null {
  const parts = token.split(".");
  if (parts.length < 2) {
    return null;
  }

  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    return JSON.parse(atob(padded)) as { role?: string };
  } catch {
    return null;
  }
}

function getRoleFromRequest(request: NextRequest): string | null {
  const roleCookie = request.cookies.get("user_role")?.value;
  if (roleCookie) {
    return roleCookie;
  }

  const token = request.cookies.get("access_token")?.value ?? request.cookies.get("token")?.value;
  if (!token) {
    return null;
  }

  return decodeJwtPayload(token)?.role ?? null;
}

export function middleware(request: NextRequest) {
  //because middleware operates on the server, it cannot access localStorage; instead, it reads the cookie.
  const token = request.cookies.get("access_token")?.value ?? request.cookies.get("token")?.value;
  const role = getRoleFromRequest(request);
  const isPublicPage = ["/login", "/register"].includes(request.nextUrl.pathname);
  const isDashboardPage = request.nextUrl.pathname === "/";
  const isGamePage = request.nextUrl.pathname.startsWith("/game");

  //unauthenticated users can only access the public pages
  if (!token && !isPublicPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (role === "admin" && isGamePage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (role === "player" && isDashboardPage) {
    return NextResponse.redirect(new URL("/game", request.url));
  }

  //authenticated users are redirected from login/register to their role home
  if (token && isPublicPage) {
    if (role === "player") {
      return NextResponse.redirect(new URL("/game", request.url));
    }

    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  //runs the middleware on all routes except next.js internals and static files
  matcher: ["/((?!_next|favicon.ico).*)"],
};
