import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const url = request.url
  console.log('🔄 CALLBACK ROUTE HIT:', url)
  console.log('📋 Full request details:', {
    url,
    method: request.method,
    headers: Object.fromEntries(request.headers),
    userAgent: request.headers.get('user-agent')
  })

  const { searchParams, origin, hash } = new URL(url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  console.log('🔍 Parsed URL components:', {
    origin,
    pathname: new URL(url).pathname,
    search: new URL(url).search,
    hash: hash || 'NO_HASH',
    fullSearchParams: Object.fromEntries(searchParams)
  })

  // Check for error parameters in URL hash (Supabase sends errors as fragments)
  if (hash && hash.includes('error')) {
    console.log('❌ Found error in hash:', hash)
    const hashParams = new URLSearchParams(hash.substring(1)) // Remove the # and parse
    const error = hashParams.get('error')
    const errorCode = hashParams.get('error_code')
    const errorDescription = hashParams.get('error_description')

    console.log('🔍 Parsed hash error params:', { error, errorCode, errorDescription })

    if (error) {
      // Redirect with specific error information
      const errorParam = errorCode === 'otp_expired'
        ? 'link_expired'
        : errorCode === 'access_denied'
        ? 'access_denied'
        : 'auth'
      console.log('🔀 Redirecting to login with error:', errorParam)
      return NextResponse.redirect(`${origin}/login?error=${errorParam}`)
    }
  }

  // Check if this is a magic link (tokens in hash)
  if (hash && (hash.includes('access_token') || hash.includes('type=magiclink'))) {
    console.log('🔗 Magic link detected, redirecting to login page for processing')
    // Redirect to login page which will handle the magic link tokens
    return NextResponse.redirect(`${origin}/login${new URL(url).search}`)
  }

  if (code) {
    console.log('✅ Found auth code, attempting to exchange for session')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    console.log('🔐 Session exchange result:', {
      success: !error,
      error: error?.message,
      user: data?.user?.email
    })

    if (!error) {
      console.log('🎉 Success! Redirecting to:', next)
      return NextResponse.redirect(`${origin}${next}`)
    } else {
      console.log('❌ Session exchange failed:', error.message)
    }
  }

  console.log('ℹ️ No OAuth code or magic link tokens found')
  console.log('🔧 This might indicate a configuration issue or the auth flow is being handled elsewhere')
  console.log('📋 Check these in Supabase Dashboard:')
  console.log('   - Authentication → URL Configuration')
  console.log('   - Site URL: http://localhost:3000')
  console.log('   - Make sure magic link redirect is working properly')

  // Return the user to login page
  return NextResponse.redirect(`${origin}/login`)
}