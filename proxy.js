import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

const PROTECTED = ['/logbook', '/groups', '/talent', '/connections', '/profile', '/mservice', '/mblog', '/messages', '/settings'];

export async function proxy(request) {
  let response = NextResponse.next({ request });

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() { return request.cookies.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            response = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    const { pathname } = request.nextUrl;

    const isProtected = PROTECTED.some(r => pathname.startsWith(r));

    if (isProtected && !user) {
      return NextResponse.redirect(new URL('/', request.url));
    }

    if ((pathname === '/' || pathname === '/login') && user) {
      return NextResponse.redirect(new URL('/logbook', request.url));
    }
  } catch (error) {
    console.error('Proxy authentication check failed:', error);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
