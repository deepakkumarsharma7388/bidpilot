import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import LogoutButton from '@/components/LogoutButton'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')

  return (
    <div className="min-h-screen bg-gray-100">
      <aside className="fixed top-0 left-0 w-64 h-full bg-white shadow-lg flex flex-col justify-between">
        <div>
          <div className="p-6">
            <h1 className="text-xl font-bold">BidPilot</h1>
            <p className="text-sm text-gray-500">Welcome, {session.user?.name}</p>
          </div>
          <nav className="mt-6">
            <Link href="/dashboard" className="block px-6 py-3 hover:bg-gray-100">📊 Dashboard</Link>
            <Link href="/jobs" className="block px-6 py-3 hover:bg-gray-100">💼 Jobs</Link>
            <Link href="/proposals" className="block px-6 py-3 hover:bg-gray-100">📝 Proposals</Link>
            <Link href="/settings" className="block px-6 py-3 hover:bg-gray-100">⚙️ Settings</Link>
          </nav>
        </div>
        <div className="border-t">
          <LogoutButton />
        </div>
      </aside>
      <main className="ml-64 p-8">{children}</main>
    </div>
  )
}