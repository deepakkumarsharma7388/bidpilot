'use client'

import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Briefcase, Send, MessageCircle, Award, DollarSign } from 'lucide-react'

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/jobs/stats')
      .then(res => res.json())
      .then(data => { setStats(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-12 text-center">Loading...</div>
  if (!stats) return <div className="p-12 text-center">Failed to load</div>

  const chartData = stats.chartData?.map((d: any) => ({
    date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    proposals: Number(d.proposals),
    replies: Number(d.replies),
    wins: Number(d.wins),
    revenue: Number(d.revenue),
  })) || []

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">📊 Dashboard</h1>
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded shadow flex items-center gap-3"><Briefcase /><div><p className="text-sm text-gray-500">Total Jobs</p><p className="text-xl font-bold">{stats.totalJobs}</p></div></div>
        <div className="bg-white p-4 rounded shadow flex items-center gap-3"><Send /><div><p className="text-sm text-gray-500">Sent</p><p className="text-xl font-bold">{stats.proposalsSent}</p></div></div>
        <div className="bg-white p-4 rounded shadow flex items-center gap-3"><MessageCircle /><div><p className="text-sm text-gray-500">Reply Rate</p><p className="text-xl font-bold">{stats.replyRate}%</p></div></div>
        <div className="bg-white p-4 rounded shadow flex items-center gap-3"><Award /><div><p className="text-sm text-gray-500">Win Rate</p><p className="text-xl font-bold">{stats.winRate}%</p></div></div>
        <div className="bg-white p-4 rounded shadow flex items-center gap-3"><DollarSign /><div><p className="text-sm text-gray-500">Revenue</p><p className="text-xl font-bold">${stats.totalRevenue}</p></div></div>
      </div>
      
      <div className="bg-white p-6 rounded shadow">
        <h2 className="font-semibold mb-4">📈 Performance Over Time</h2>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis /><Tooltip /><Legend />
            <Line type="monotone" dataKey="proposals" stroke="#3b82f6" name="Proposals" />
            <Line type="monotone" dataKey="replies" stroke="#8b5cf6" name="Replies" />
            <Line type="monotone" dataKey="wins" stroke="#22c55e" name="Wins" />
            <Line type="monotone" dataKey="revenue" stroke="#f59e0b" name="Revenue" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white p-6 rounded shadow">
        <h2 className="font-semibold mb-4">📊 Performance by Lane</h2>
        <table className="w-full text-sm">
          <thead className="bg-gray-50"><tr><th className="p-3 text-left">Lane</th><th className="p-3 text-left">Proposals</th><th className="p-3 text-left">Replies</th><th className="p-3 text-left">Wins</th><th className="p-3 text-left">Revenue</th></tr></thead>
          <tbody>
            {stats.laneStats?.map((row: any, i: number) => (
              <tr key={i} className="border-t"><td className="p-3 font-medium">{row.lane}</td><td className="p-3">{row.proposals}</td><td className="p-3">{row.replies}</td><td className="p-3">{row.wins}</td><td className="p-3">${Number(row.revenue).toFixed(0)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
