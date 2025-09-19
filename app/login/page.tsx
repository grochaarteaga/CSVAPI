'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '../../lib/supabase/client'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Mail, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const searchParams = useSearchParams()

  useEffect(() => {
    const handleAuthRedirect = async () => {
      // Check for error in query parameters
      const errorParam = searchParams.get('error')

      // Check for authentication data in URL hash
      const hash = typeof window !== 'undefined' ? window.location.hash : ''
      let hashData = null
      if (hash) {
        const hashParams = new URLSearchParams(hash.substring(1))
        hashData = {
          accessToken: hashParams.get('access_token'),
          refreshToken: hashParams.get('refresh_token'),
          expiresAt: hashParams.get('expires_at'),
          tokenType: hashParams.get('token_type'),
          type: hashParams.get('type'),
          error: hashParams.get('error'),
          errorCode: hashParams.get('error_code'),
          errorDescription: hashParams.get('error_description')
        }
        console.log('🔍 Found data in URL hash:', hashData)
      }

      // Handle successful authentication
      if (hashData && hashData.accessToken && hashData.type === 'magiclink') {
        console.log('✅ Found access token, setting session')
        console.log('🔑 Access token present:', !!hashData.accessToken)
        console.log('🔄 Refresh token present:', !!hashData.refreshToken)

        try {
          const { data, error } = await supabase.auth.setSession({
            access_token: hashData.accessToken,
            refresh_token: hashData.refreshToken || ''
          })

          console.log('📊 Session set result:', { hasError: !!error, hasUser: !!data?.user })

          if (error) {
            console.error('❌ Session set error:', error)
            setError('Failed to authenticate. Please try again.')
          } else if (data.user) {
            console.log('🎉 Authentication successful, user:', data.user.email)
            console.log('🏠 Current location before redirect:', typeof window !== 'undefined' ? window.location.href : 'N/A')

            // Clear the hash to clean up the URL
            if (typeof window !== 'undefined') {
              window.history.replaceState(null, '', window.location.pathname)
            }

            // Small delay to ensure session is fully established
            setTimeout(() => {
              console.log('🔀 Redirecting to dashboard...')
              window.location.href = '/dashboard'
            }, 100)
          } else {
            console.log('⚠️ Session set but no user data')
            setError('Authentication incomplete. Please try again.')
          }
        } catch (err) {
          console.error('❌ Authentication error:', err)
          setError('Authentication failed. Please try again.')
        }
        return
      }

      // Handle errors
      if (hashData && hashData.error) {
        console.log('❌ Found error in URL hash:', hashData)
        switch (hashData.errorCode) {
          case 'otp_expired':
            setError('The magic link has expired. Please request a new one.')
            break
          case 'access_denied':
            setError('Access was denied. Please try again.')
            break
          default:
            setError(`Authentication error: ${hashData.errorDescription || 'Please try again.'}`)
            break
        }
      } else if (errorParam) {
        switch (errorParam) {
          case 'link_expired':
            setError('The magic link has expired. Please request a new one.')
            break
          case 'access_denied':
            setError('Access was denied. Please try again.')
            break
          case 'auth':
          default:
            setError('Authentication failed. Please try again.')
            break
        }
      }
    }

    handleAuthRedirect()
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return

    setLoading(true)
    setError('') // Clear any previous errors
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/login`
        }
      })

      if (error) throw error

      setSent(true)
      toast.success('Magic link sent! Check your email.')
    } catch (error: any) {
      toast.error(error.message || 'Failed to send magic link')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Mail className="h-12 w-12 text-blue-500 mx-auto mb-4" />
            <CardTitle>Check your email</CardTitle>
            <CardDescription>
              We've sent a magic link to {email}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-gray-600 mb-4">
              Click the link in your email to sign in to your account.
            </p>
            <Button
              variant="outline"
              onClick={() => setSent(false)}
              className="w-full"
            >
              Send another link
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Welcome to CSV Upload App</CardTitle>
          <CardDescription>
            Sign in with your email to get started
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4" suppressHydrationWarning>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email address
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (error) setError('') // Clear error when user starts typing
                }}
                placeholder="Enter your email"
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={loading || !email}
            >
              {loading ? 'Sending...' : 'Send Magic Link'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}