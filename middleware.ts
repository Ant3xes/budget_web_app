import { NextResponse, type NextRequest } from "next/server";

import { PROTECTED_PATHS } from "@/lib/constants";
import { updateSession } from "@/lib/supabase/middleware";

const authRoutes = ["/login", "/signup"];

const isPathMatching = (pathname: string, basePath: string) => {
  return pathname === basePath || pathname.startsWith(`${basePath}/`);
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtectedPath = PROTECTED_PATHS.some((path) =>
    isPathMatching(pathname, path),
  );
  const isAuthRoute = authRoutes.some((route) => isPathMatching(pathname, route));

  if (!isProtectedPath && !isAuthRoute) {
    return NextResponse.next();
  }

  const { response, user } = await updateSession(request);

  if (isProtectedPath && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isAuthRoute && user) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
