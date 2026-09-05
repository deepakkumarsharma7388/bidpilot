'use client'

import { useEffect, useState } from 'react'
import { Eye, Send, SkipForward, Sparkles, Loader2, RefreshCw, ShieldAlert } from 'lucide-react'
import Link from 'next/link'

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending (not yet matched)',
  MATCHED: 'Proposal Ready',
  PROPOSAL_SENT: 'Submitted to Upwork',
  PROPOSAL_FAILED: 'Submit Failed',
  IGNORED: 'Skipped',
  HIRED: 'Hired',
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [infoMsg, setInfoMsg] = useState<string | null>(null)
  const [showSkipped, setShowSkipped] = useState(false)
  const [showSuspicious, setShowSuspicious] = useState(false)

  const fetchJobs = async () => {
    const res = await fetch('/api/jobs')
    const data = await res.json()
    setJobs(data)
    setLoading(false)
  }

  useEffect(() => { fetchJobs() }, [])

  const handleSync = async () => {
    setSyncing(true)
    setErrorMsg(null)
    setInfoMsg(null)
    try {
      const res = await fetch('/api/scrape', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErrorMsg(data?.error || 'Could not start scraping.')
        setSyncing(false)
        return
      }
      setInfoMsg('Scrape started — this runs in the worker (npm run worker) and can take up to a minute. This list will refresh automatically.')

      let attempts = 0
      const interval = setInterval(async () => {
        attempts++
        await fetchJobs()
        if (attempts >= 18) {
          clearInterval(interval)
          setSyncing(false)
        }
      }, 5000)
    } catch (e) {
      setErrorMsg('Network error — could not reach the server.')
      setSyncing(false)
    }
  }

  const handleAction = async (jobId: string, action: 'generate' | 'submit' | 'skip') => {
    setActionLoading(jobId)
    setErrorMsg(null)
    try {
      const res = await fetch(`/api/jobs/${jobId}/${action}`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data?.success === false || data?.error) {
        setErrorMsg(data?.error || 'Something went wrong. Please try again.')
      }
      await fetchJobs()
    } catch (e) {
      setErrorMsg('Network error — could not reach the server.')
    }
    setActionLoading(null)
  }

  const getPriority = (score: number) => {
    if (score >= 0.8) return { label: 'P1 - Act Now', color: 'border-green-500 bg-green-50' }
    if (score >= 0.6) return { label: 'P2 - Batch', color: 'border-yellow-500 bg-yellow-50' }
    return { label: 'Archive', color: 'border-gray-300 bg-gray-50' }
  }

  if (loading) return <div className="p-12 text-center">Loading...</div>

  const visibleJobs = jobs
    .filter((j) => showSkipped || j.status !== 'IGNORED')
    .filter((j) => showSuspicious || !j.isSuspicious)

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h1 className="text-2xl font-bold">💼 Jobs</h1>
        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={showSuspicious} onChange={(e) => setShowSuspicious(e.target.checked)} />
            Show flagged/suspicious
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={showSkipped} onChange={(e) => setShowSkipped(e.target.checked)} />
            Show skipped
          </label>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm flex items-center gap-2 disabled:opacity-60"
          >
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {syncing ? 'Scraping...' : 'Sync from Upwork'}
          </button>
        </div>
      </div>

      {infoMsg && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 text-sm px-4 py-3 rounded">
          ℹ️ {infoMsg}
        </div>
      )}

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded flex justify-between items-center">
          <span>⚠️ {errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-red-600 ml-4">✕</button>
        </div>
      )}

      {visibleJobs.length === 0 && (
        <div className="bg-white p-8 rounded shadow text-center text-gray-500">
          No jobs to show. Click "Sync from Upwork" to fetch jobs, or check the filter checkboxes above.
        </div>
      )}

      {visibleJobs.map(job => {
        const p = getPriority(job.matchScore || 0)
        const isSkipped = job.status === 'IGNORED'
        return (
          <div
            key={job.id}
            className={`bg-white p-4 rounded-lg shadow border-l-4 ${job.isSuspicious ? 'border-red-500 bg-red-50' : p.color} ${isSkipped ? 'opacity-50' : ''}`}
          >
            <div className="flex justify-between items-start">
              <div>
                <div className="flex gap-2 text-xs items-center flex-wrap">
                  {job.isSuspicious && (
                    <span className="flex items-center gap-1 bg-red-600 text-white px-2 py-0.5 rounded font-bold">
                      <ShieldAlert className="h-3 w-3" /> Possible Fake
                    </span>
                  )}
                  <span className="font-bold">{p.label}</span>
                  <span className="bg-gray-200 px-2 rounded">{job.lane}</span>
                  <span className="bg-blue-100 text-blue-700 px-2 rounded">{STATUS_LABELS[job.status] || job.status}</span>
                </div>
                <h3 className="font-medium">{job.title}</h3>
                <div className="flex gap-4 text-sm text-gray-600">💰 {job.currency} {job.budget} 🎯 {Math.round((job.matchScore || 0) * 100)}%</div>
                {(job.clientCountry || job.clientHireRate != null || job.clientTotalSpent != null) && (
                  <div className="flex gap-3 text-xs text-gray-500 mt-1 flex-wrap">
                    {job.clientCountry && <span>🌍 {job.clientCountry}</span>}
                    {job.clientHireRate != null && <span>🤝 {job.clientHireRate}% hire rate</span>}
                    {job.clientTotalSpent != null && <span>💵 ${job.clientTotalSpent.toLocaleString()} spent</span>}
                    {job.clientPaymentVerified === true && <span>✅ Payment verified</span>}
                  </div>
                )}
                {job.filteredReason && (
                  <p className="text-xs text-orange-700 mt-1">🌍 Not auto-proposed: {job.filteredReason}</p>
                )}
                {job.isSuspicious && job.suspicionReasons && (
                  <p className="text-xs text-red-700 mt-1">🚩 {job.suspicionReasons}</p>
                )}
              </div>
              <div className="flex gap-2">
                <Link href={job.url || '#'} target="_blank">
                  <button className="p-2 border rounded hover:bg-gray-50" title="View job on Upwork"><Eye className="h-4 w-4" /></button>
                </Link>
                <button onClick={() => handleAction(job.id, 'generate')} disabled={actionLoading === job.id} className="p-2 border rounded hover:bg-blue-50 text-blue-600" title="Generate AI proposal">
                  {actionLoading === job.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                </button>
                <button onClick={() => handleAction(job.id, 'submit')} disabled={actionLoading === job.id} className="p-2 border rounded hover:bg-green-50 text-green-600" title="Submit proposal to Upwork">
                  <Send className="h-4 w-4" />
                </button>
                <button onClick={() => handleAction(job.id, 'skip')} disabled={actionLoading === job.id || isSkipped} className="p-2 border rounded hover:bg-red-50 text-red-400" title="Skip this job">
                  <SkipForward className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}