import { jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";

function getSessionSecret() {
  return new TextEncoder().encode(process.env.DM_AGENT_SESSION_SECRET!.trim());
}

export async function middleware(request: NextRequest) {
  // Local dev (`next dev`) skips the tools.vipscaleph.com SSO. Never true in `next build`/`next start`.
  if (process.env.NODE_ENV === "development") {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname.startsWith("/auth/sso")) {
    return NextResponse.next();
  }

  // Called by n8n with a bearer secret (checked inside the route), so no SSO cookie
  if (request.nextUrl.pathname === "/api/auto-draft-followups") {
    return NextResponse.next();
  }

  const cookie = request.cookies.get("dm_agent_session")?.value;
  if (cookie) {
    try {
      await jwtVerify(cookie, getSessionSecret());
      return NextResponse.next();
    } catch {
      // fall through to redirect
    }
  }

  return NextResponse.redirect("https://tools.vipscaleph.com/api/sso/dm-agent");
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
