import { jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";

function getSessionSecret() {
  return new TextEncoder().encode(process.env.DM_AGENT_SESSION_SECRET!.trim());
}

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/auth/sso")) {
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
