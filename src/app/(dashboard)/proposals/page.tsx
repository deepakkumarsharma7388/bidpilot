'use client'

import { useEffect, useState } from 'react'
import { ExternalLink } from 'lucide-react'

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  GENERATED: 'bg-blue-100 text-blue-700',
  SENT: 'bg-purple-100 text-purple-700',
  FAILED: 'bg-red-100 text-red-700',
  VIEWED: 'bg-yellow-100 text-yellow-700',
  REPLIED: 'bg-indigo-100 text-indigo-700',
  HIRED: 'bg-green-100 text-green-700',
}

export default function ProposalsPage() {
  const [jobs, setJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/jobs')
      .then(res => res.json())
      .then(data => { setJobs(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  // Flatten all proposals across jobs
  const proposals = jobs.flatMap(job =>
    (job.proposals || []).map((p: any) => ({ ...p, job }))
  )

  if (loading) return <div className="p-12 text-center">Loading...</div>

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">📝 Proposals</h1>

      {proposals.length === 0 && (
        <div className="bg-white p-8 rounded shadow text-center text-gray-500">
          No proposals yet. Generate one from the Jobs page.
        </div>
      )}

      {proposals.map((p) => (
        <div key={p.id} className="bg-white p-4 rounded-lg shadow">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs font-semibold px-2 py-1 rounded ${STATUS_COLORS[p.status] || 'bg-gray-100 text-gray-700'}`}>
                  {p.status}
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(p.createdAt).toLocaleDateString()}
                </span>
              </div>
              <h3 className="font-medium">{p.job?.title}</h3>
              <p className="text-sm text-gray-600 mt-2 whitespace-pre-line ">{p.content}</p>
              {p.submitError && (
                <p className="text-xs text-red-500 mt-1">Error: {p.submitError}</p>
              )}
            </div>
            {p.job?.url && (
              <a href={p.job.url} target="_blank" rel="noreferrer" className="p-2 border rounded hover:bg-gray-50">
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
