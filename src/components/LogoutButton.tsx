'use client'

import { signOut } from 'next-auth/react'
import { LogOut } from 'lucide-react'

export default function LogoutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/login' })}
      className="flex items-center gap-2 px-6 py-3 w-full text-left text-red-600 hover:bg-red-50 text-sm"
    >
      <LogOut className="h-4 w-4" />
      Logout
    </button>
  )
}