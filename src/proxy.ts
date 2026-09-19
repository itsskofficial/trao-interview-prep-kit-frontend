import { NextResponse, type NextRequest } from "next/server";

const SIGNED_OUT_ONLY = ["/login", "/register"];

/**
 * A fast first gate, based only on whether a session cookie is present. It cannot tell whether the
 * cookie is still valid; the API decides that, and the client sends the user back here on a 401.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = request.cookies.has("session");
  const signedOutOnly = SIGNED_OUT_ONLY.includes(pathname);

  if (!hasSession && !signedOutOnly) {
    const login = new URL("/login", request.url);
    if (pathname !== "/") login.searchParams.set("next", pathname + search);
    return NextResponse.redirect(login);
  }
  if (hasSession && signedOutOnly) return NextResponse.redirect(new URL("/", request.url));
  return NextResponse.next();
}

export const config = {
  // Everything except the API (which answers 401 itself), Next's own assets and static files.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\.(?:png|svg|ico|txt)$).*)"],
};
