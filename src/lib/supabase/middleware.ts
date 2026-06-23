import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options: CookieOptions };

// Refreshes the Supabase auth session on every request and guards the app.
// Unauthenticated users are redirected to /login (except for /login itself and
// the auth callback). If Supabase isn't configured yet, we pass through so the
// project still boots.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Skip the auth round-trip on PREFETCH requests. Next.js prefetches linked
  // routes on hover / when they scroll into view; doing a getUser() (a call to
  // Supabase's auth server) for each of those is pure overhead. A prefetch is
  // never the navigation itself, so it doesn't need guarding — the real request
  // that follows still runs the full check here, and (app)/layout.tsx guards the
  // page regardless. This removes the bulk of the per-request auth traffic.
  const isPrefetch =
    request.headers.get("next-router-prefetch") === "1" ||
    request.headers.get("purpose") === "prefetch" ||
    request.headers.get("sec-purpose")?.includes("prefetch") === true;
  if (isPrefetch) return response;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return response;

  try {
    const supabase = createServerClient(url, anon, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const path = request.nextUrl.pathname;
    const isPublic = path.startsWith("/login") || path.startsWith("/auth");

    // A redirect that PRESERVES every cookie the session refresh just set on
    // `response`. Supabase rotates (single-use) refresh tokens, so dropping the
    // freshly-set cookies on a redirect leaves the browser holding stale tokens.
    // The next request then fails auth and redirects back — an endless
    // /dashboard ⇄ /login reload loop that the user can't escape. Copying the
    // cookies onto the redirect response is what breaks that cycle.
    const redirectTo = (pathname: string) => {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = pathname;
      const redirect = NextResponse.redirect(redirectUrl);
      for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
      return redirect;
    };

    if (!user && !isPublic) return redirectTo("/login");

    if (user && path.startsWith("/login")) return redirectTo("/dashboard");

    return response;
  } catch {
    // Never let the middleware crash the whole app. If session refresh fails
    // (misconfig, transient network), fall through — the per-page server-side
    // auth guard in (app)/layout.tsx still protects protected routes.
    return response;
  }
}
