'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const result = await signIn('credentials', { email, password, redirect: false })
    if (result?.error) {
      setError('Invalid email or password')
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full p-8 bg-white rounded-lg shadow">
        <h1 className="text-2xl font-bold text-center">Login</h1>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4" autoComplete="off" suppressHydrationWarning>
          <input type="email" placeholder="Email" className="w-full border p-2 rounded" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="off" suppressHydrationWarning />
          <input type="password" placeholder="Password" className="w-full border p-2 rounded" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="off" suppressHydrationWarning />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded" disabled={loading}>{loading ? 'Loading...' : 'Login'}</button>
        </form>
        <p className="text-center text-sm mt-4">Don't have account? <Link href="/signup" className="text-blue-600">Sign up</Link></p>
      </div>
    </div>
  )
}