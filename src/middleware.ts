import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_DEV_TOOLS !== "true" && request.nextUrl.pathname.startsWith("/dev/")) {
    return new NextResponse(null, { status: 404 });
  }
  return NextResponse.next();
}

export const config = { matcher: ["/dev/:path*"] };
