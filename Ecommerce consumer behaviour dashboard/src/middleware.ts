import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

import { locales, localePrefix, defaultLocale } from "./i18n/navigation";

const handleI18nRouting = createMiddleware({
  locales,
  defaultLocale,
  localePrefix,
  localeDetection: false,
});

const isPublicRoute = createRouteMatcher([
  "/login(.*)",
  "/register(.*)",
  "/en/login(.*)",
  "/pl/login(.*)",
  "/en/register(.*)",
  "/pl/register(.*)",
  "/api/health(.*)",
  "/api/datasets(.*)",
  "/api/dataset(.*)",
  "/api/upload(.*)",
  "/api/analytics(.*)",
]);

const getLocalePrefixFromPath = (pathname: string) => {
  const parts = pathname.split("/").filter(Boolean);
  const maybeLocale = parts[0];
  return locales.includes(maybeLocale as (typeof locales)[number]) ? maybeLocale : null;
};

export default clerkMiddleware((auth, request: NextRequest) => {
  const path = request.nextUrl.pathname;

  if (path.startsWith("/api")) {
    if (!isPublicRoute(request)) {
      return auth().then((a) => {
        if (!a.userId) {
          return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
        }
        return NextResponse.next();
      });
    }
    return NextResponse.next();
  }

  if (!isPublicRoute(request)) {
    return auth().then((a) => {
      if (a.userId) {
        return handleI18nRouting(request);
      }

      const localePrefix = getLocalePrefixFromPath(path);
      const loginPath = localePrefix ? `/${localePrefix}/login` : "/login";
      const url = request.nextUrl.clone();
      url.pathname = loginPath;
      url.searchParams.set("redirect_url", request.nextUrl.pathname + request.nextUrl.search);
      return NextResponse.redirect(url);
    });
  }

  return handleI18nRouting(request);
});

export const config = {
  matcher: [
    "/((?!_next|_vercel|trpc|.*\\..*).*)",
    "/api/(.*)",
  ],
};
