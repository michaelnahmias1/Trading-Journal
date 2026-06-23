import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Run on everything EXCEPT:
  //  - static assets, image files and PWA metadata (manifest + icons must stay
  //    publicly fetchable so the app can install);
  //  - /api/* routes — they authenticate themselves (each returns 401 when
  //    signed out) and refresh their own session, so a middleware getUser() on
  //    every poll (e.g. /api/fx, /api/quote every 30s) is wasted work.
  matcher: [
    "/((?!_next/static|_next/image|api|favicon.ico|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|webmanifest)$).*)",
  ],
};
