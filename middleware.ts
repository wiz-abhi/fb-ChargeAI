import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  // Add any custom middleware logic here
  return NextResponse.next()
}

export const config = {
  matcher: ["/api/:path*"],
}

