'use client';

import { useState } from 'react';

export default function AdminPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const createMaster = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/create-master', { method: 'POST' });
      const data = await res.json();
      setResult(data);
    } catch (error) {
      setResult({ error: String(error) });
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/reset-master-password', { method: 'POST' });
      const data = await res.json();
      setResult(data);
    } catch (error) {
      setResult({ error: String(error) });
    } finally {
      setLoading(false);
    }
  };

  const checkMaster = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/create-master');
      const data = await res.json();
      setResult(data);
    } catch (error) {
      setResult({ error: String(error) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Admin Tools</h1>
        
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <div>
            <h2 className="text-xl font-semibold mb-4">Master Account Management</h2>
            <div className="space-y-3">
              <button
                onClick={checkMaster}
                disabled={loading}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Check Master Account Status'}
              </button>
              
              <button
                onClick={createMaster}
                disabled={loading}
                className="w-full bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Master Account (nhkim@rsupport.com)'}
              </button>
              
              <button
                onClick={resetPassword}
                disabled={loading}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded disabled:opacity-50"
              >
                {loading ? 'Resetting...' : 'Reset Password to 111111'}
              </button>
            </div>
          </div>

          {result && (
            <div className="mt-6 p-4 bg-gray-100 rounded">
              <h3 className="font-semibold mb-2">Result:</h3>
              <pre className="text-sm overflow-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}

          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
            <h3 className="font-semibold text-yellow-800 mb-2">Instructions:</h3>
            <ol className="text-sm text-yellow-700 space-y-1 list-decimal list-inside">
              <li>Click "Check Master Account Status" to see if account exists</li>
              <li>Click "Create Master Account" if it doesn't exist</li>
              <li>Click "Reset Password" if you need to reset to 111111</li>
              <li>Login at /login with nhkim@rsupport.com / 111111</li>
              <li>You'll be redirected to /change-password to set a new password</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
