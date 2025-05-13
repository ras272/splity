import { NextResponse, type NextRequest } from "next/server"
import { updateSession } from "@/utils/supabase/middleware"
import { createServerClient } from "@supabase/ssr"

export async function middleware(request: NextRequest) {
  // Update the session on each request
  const response = await updateSession(request)

  // Get the pathname from the URL
  const pathname = request.nextUrl.pathname

  // Get the user from the session
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  // Create a Supabase client for auth
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value
      },
      set() {}, // We don't need to set cookies in this middleware
      remove() {}, // We don't need to remove cookies in this middleware
    },
  })

  // Get the user from the session
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Si estamos en la ruta de callback, permitir el acceso sin redirección
  if (pathname === "/auth/callback") {
    return response
  }

  // If the user is not signed in and the pathname is not /login or /signup, redirect to /login
  if (!user && pathname !== "/login" && pathname !== "/signup") {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  // If the user is signed in and the pathname is /login or /signup, redirect to /dashboard
  if (user && (pathname === "/login" || pathname === "/signup" || pathname === "/")) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
