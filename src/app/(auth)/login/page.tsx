'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  // Check for error from query params
  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam === 'domain_restricted') {
      setError('로그인이 제한되었습니다. 관리자가 등록한 계정만 접근 가능합니다.');
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Double-submit protection
    if (loading) return;
    
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      // Step 1: Supabase Auth 로그인
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      // Check for rate limiting
      if (authError && (authError as { status?: number }).status === 429) {
        throw new Error('너무 많은 로그인 시도가 있었습니다. 잠시 후 다시 시도해주세요.');
      }
      
      // Generic error for any auth failure (prevents user enumeration)
      if (authError) {
        throw new Error('이메일 또는 비밀번호가 올바르지 않습니다.');
      }
      
      if (!authData.user) {
        throw new Error('이메일 또는 비밀번호가 올바르지 않습니다.');
      }

      // Step 2: Check if user exists in public.users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('id', authData.user.id)
        .single();

      if (userError || !userData) {
        // User not registered in the system - sign out immediately
        // Wrap in try/catch to handle race condition
        try {
          await supabase.auth.signOut();
        } catch {
          // Ensure we still throw auth error even if signOut fails
        }
        throw new Error('이메일 또는 비밀번호가 올바르지 않습니다.');
      }

      // Step 3: Successful login - redirect to dashboard
      router.push('/');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
      // Clear password on error for security
      setPassword('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h1 className="text-center text-3xl font-bold text-gray-900">
            Translation Manager
          </h1>
          <h2 className="mt-6 text-center text-xl text-gray-600">
            로그인
          </h2>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}
          {message && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
              {message}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                이메일
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="email@example.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                비밀번호
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '처리 중...' : '로그인'}
            </button>
          </div>

          {/* Access Restriction Notice */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
            <div className="flex items-start gap-2">
              <svg
                className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-medium text-yellow-800">
                  접근 제한 안내
                </p>
                <p className="text-xs text-yellow-700 mt-1">
                  관리자가 등록한 계정만 로그인 가능합니다
                </p>
              </div>
            </div>
          </div>
        </form>

        <div className="text-center text-sm text-gray-500">
          계정이 필요하신가요? 관리자에게 문의하세요
        </div>
      </div>
    </div>
  );
}
