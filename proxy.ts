import { NextResponse, type NextRequest } from "next/server";

import { PROTECTED_PATHS } from "@/lib/constants";
import { buildCsp } from "@/lib/csp/build-csp";
import { updateSession } from "@/lib/supabase/middleware";

const authRoutes = ["/login", "/signup"];

const isPathMatching = (pathname: string, basePath: string) => {
  return pathname === basePath || pathname.startsWith(`${basePath}/`);
};

/**
 * Content-Security-Policy-Report-Only with a per-request nonce (issue 163,
 * ADR 0005). The nonce travels to the layout through the x-nonce request
 * header; Next.js reads the CSP request header to nonce its own scripts.
 */
const withCsp = (request: NextRequest, handle: (request: NextRequest) => Promise<NextResponse>) => {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp({
    nonce,
    isDev: process.env.NODE_ENV === "development",
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  });
  request.headers.set("x-nonce", nonce);
  request.headers.set("Content-Security-Policy-Report-Only", csp);
  return handle(request).then((response) => {
    response.headers.set("Content-Security-Policy-Report-Only", csp);
    return response;
  });
};

const handleRequest = async (request: NextRequest) => {
  const { pathname } = request.nextUrl;
  const isProtectedPath = PROTECTED_PATHS.some((path) =>
    isPathMatching(pathname, path),
  );
  const isAuthRoute = authRoutes.some((route) => isPathMatching(pathname, route));

  if (!isProtectedPath && !isAuthRoute) {
    return NextResponse.next({ request });
  }

  const { response, user } = await updateSession(request);

  if (isProtectedPath && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isAuthRoute && user) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
};

export async function proxy(request: NextRequest) {
  return withCsp(request, handleRequest);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
