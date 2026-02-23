import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Check for @rsupport.com domain restriction
      const email = data.user.email;
      if (!email || !email.endsWith('@rsupport.com')) {
        // Sign out the user immediately
        await supabase.auth.signOut();

        // Redirect to login with domain error
        return NextResponse.redirect(`${origin}/login?error=domain_restricted`);
      }

      // Extract name from Google OAuth metadata
      const userName = data.user.user_metadata?.full_name ||
                       data.user.user_metadata?.name ||
                       null;

      // Update or create user record with name
      if (userName) {
        await supabase
          .from('users')
          .upsert({
            id: data.user.id,
            email: email,
            name: userName,
            avatar_url: data.user.user_metadata?.avatar_url || null,
          }, {
            onConflict: 'id'
          });
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
