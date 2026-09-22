import { jwtVerify, SignJWT } from "jose";
import { NextRequest, NextResponse } from "next/server";

const ISSUER = "tools.vipscaleph.com";
const AUDIENCE = "dm-agent";

function getHandoffSecret() {
  const secret = process.env.SSO_SHARED_SECRET?.trim();
  if (!secret) throw new Error("Missing SSO_SHARED_SECRET");
  return new TextEncoder().encode(secret);
}

function getSessionSecret() {
  const secret = process.env.DM_AGENT_SESSION_SECRET?.trim();
  if (!secret) throw new Error("Missing DM_AGENT_SESSION_SECRET");
  return new TextEncoder().encode(secret);
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect("https://tools.vipscaleph.com/api/sso/dm-agent");
  }

  let email: string | undefined;
  try {
    const { payload } = await jwtVerify(token, getHandoffSecret(), {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    email = payload.email as string | undefined;
  } catch {
    return NextResponse.redirect("https://tools.vipscaleph.com/api/sso/dm-agent");
  }

  if (!email) {
    return NextResponse.redirect("https://tools.vipscaleph.com/api/sso/dm-agent");
  }

  // Long-lived local session — separate token/secret from the one-time handoff token above.
  const sessionToken = await new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSessionSecret());

  const response = NextResponse.redirect(new URL("/", request.url));
  response.cookies.set("dm_agent_session", sessionToken, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
