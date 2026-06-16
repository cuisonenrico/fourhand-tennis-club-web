import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/**
 * Refreshes the Supabase auth session and guards the admin area.
 * Unauthenticated requests to /admin/* (except the login page) are redirected
 * to the login screen (Plan §10.1 — the admin cannot be reached without signing in).
 */
export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // Without Supabase configured we can't authenticate — fail safe by blocking admin.
  if (!url || !anon) {
    if (isProtectedAdmin(request)) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    return response;
  }

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && isProtectedAdmin(request)) {
    const loginUrl = new URL("/admin/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

function isProtectedAdmin(request: NextRequest): boolean {
  const path = request.nextUrl.pathname;
  return path.startsWith("/admin") && path !== "/admin/login";
}

export const config = {
  matcher: ["/admin/:path*"],
};
