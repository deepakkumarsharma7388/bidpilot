'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SignupPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    })
    if (res.ok) {
      router.push('/login?registered=true')
    } else {
      const data = await res.json()
      setError(data.error || 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full p-8 bg-white rounded-lg shadow">
        <h1 className="text-2xl font-bold text-center">Sign Up</h1>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4" autoComplete="off" suppressHydrationWarning>
          <input type="text" placeholder="Full Name" className="w-full border p-2 rounded" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="off" suppressHydrationWarning />
          <input type="email" placeholder="Email" className="w-full border p-2 rounded" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="new-email" name="signup-email" suppressHydrationWarning />
          <input type="password" placeholder="Password" className="w-full border p-2 rounded" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete="new-password" name="signup-password" suppressHydrationWarning />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded" disabled={loading}>{loading ? 'Creating...' : 'Sign Up'}</button>
        </form>
        <p className="text-center text-sm mt-4">Already have account? <Link href="/login" className="text-blue-600">Login</Link></p>
      </div>
    </div>
  )
}