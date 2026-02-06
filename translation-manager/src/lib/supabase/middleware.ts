import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Public routes (no auth required)
  const publicPaths = ['/admin', '/login', '/change-password'];
  const isPublicPath = publicPaths.some(
    path => request.nextUrl.pathname === path || request.nextUrl.pathname.startsWith(path + '/')
  );

  // Protected routes
  const protectedPaths = ['/', '/upload', '/translations', '/glossary', '/settings'];
  const isProtectedPath = protectedPaths.some(
    path => request.nextUrl.pathname === path || request.nextUrl.pathname.startsWith(path + '/')
  );

  if (isProtectedPath && !user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Check if password reset is required
  if (user && request.nextUrl.pathname !== '/change-password') {
    const { data: userData } = await supabase
      .from('users')
      .select('password_reset_required')
      .eq('id', user.id)
      .single();

    if (userData?.password_reset_required) {
      const url = request.nextUrl.clone();
      url.pathname = '/change-password';
      return NextResponse.redirect(url);
    }
  }

  // Redirect logged-in users away from login page
  if (request.nextUrl.pathname === '/login' && user) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
