'use client'

import { useState, useEffect } from 'react'

export default function SettingsPage() {
  const [loading, setLoading] = useState(false)
  const [lanes, setLanes] = useState('Shopify CRO, React Dev, B2B SEO')
  const [budgetMin, setBudgetMin] = useState('')
  const [budgetMax, setBudgetMax] = useState('')
  const [keywords, setKeywords] = useState('')
  const [timezone, setTimezone] = useState('')
  const [autoSubmit, setAutoSubmit] = useState(false)
  const [cookies, setCookies] = useState('')
  const [status, setStatus] = useState('')

  // Client-quality filters — fully user-configurable
  const [excludedRegions, setExcludedRegions] = useState('')
  const [minHireRate, setMinHireRate] = useState('')
  const [minTotalSpent, setMinTotalSpent] = useState('')
  const [requirePaymentVerified, setRequirePaymentVerified] = useState(false)

  useEffect(() => {
    fetch('/api/user/settings').then(res => res.json()).then(data => {
      setLanes((data.lanes || ['Shopify CRO', 'React Dev', 'B2B SEO']).join(', '))
      setBudgetMin(data.budgetMin || '')
      setBudgetMax(data.budgetMax || '')
      setKeywords(data.keywords || '')
      setTimezone(data.timezone || '')
      setAutoSubmit(data.autoSubmit || false)
      setExcludedRegions((data.excludedRegions || []).join(', '))
      setMinHireRate(data.minHireRate ?? '')
      setMinTotalSpent(data.minTotalSpent ?? '')
      setRequirePaymentVerified(data.requirePaymentVerified || false)
    })
  }, [])

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true)
    await fetch('/api/user/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lanes: lanes.split(',').map(s => s.trim()).filter(Boolean),
        budgetMin: parseFloat(budgetMin) || null,
        budgetMax: parseFloat(budgetMax) || null,
        keywords,
        timezone,
        autoSubmit,
        excludedRegions: excludedRegions.split(',').map(s => s.trim()).filter(Boolean),
        minHireRate: minHireRate === '' ? null : parseFloat(minHireRate),
        minTotalSpent: minTotalSpent === '' ? null : parseFloat(minTotalSpent),
        requirePaymentVerified,
      })
    })
    setStatus('✅ Settings saved!'); setLoading(false)
  }

  const saveCookies = async () => {
    try {
      await fetch('/api/upwork/cookies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookies: JSON.parse(cookies) })
      })
      setStatus('✅ Cookies saved!')
    } catch {
      setStatus('❌ Invalid JSON')
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">⚙️ Settings</h1>
      <form onSubmit={saveSettings} className="space-y-4 bg-white p-6 rounded shadow">
        <div><label className="font-semibold">Lanes</label><input type="text" className="w-full border p-2 rounded" value={lanes} onChange={e => setLanes(e.target.value)} /></div>
        <div className="flex gap-4">
          <div className="w-1/2"><label>Min Budget ($)</label><input type="number" className="w-full border p-2 rounded" value={budgetMin} onChange={e => setBudgetMin(e.target.value)} /></div>
          <div className="w-1/2"><label>Max Budget ($)</label><input type="number" className="w-full border p-2 rounded" value={budgetMax} onChange={e => setBudgetMax(e.target.value)} /></div>
        </div>
        <div><label>Keywords</label><textarea className="w-full border p-2 rounded" value={keywords} onChange={e => setKeywords(e.target.value)} /></div>
        <div>
          <label>Timezone</label>
          <select className="w-full border p-2 rounded" value={timezone} onChange={e => setTimezone(e.target.value)}>
            <option value="">Any</option>
            <option value="US/Eastern">US/Eastern</option>
            <option value="US/Pacific">US/Pacific</option>
          </select>
        </div>
        <div className="flex justify-between items-center">
          <span className="font-semibold">Auto-Submit</span>
          <button type="button" onClick={() => setAutoSubmit(!autoSubmit)} className={`px-6 py-2 rounded text-white ${autoSubmit ? 'bg-green-600' : 'bg-gray-400'}`}>{autoSubmit ? 'ON' : 'OFF'}</button>
        </div>
        <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded">💾 Save</button>
        {status && <p className="text-green-600">{status}</p>}
      </form>

      <div className="space-y-4 bg-white p-6 rounded shadow border-t-4 border-purple-400">
        <h2 className="font-semibold text-lg">🎯 Client Quality Filters</h2>
        <p className="text-sm text-gray-500">
          These control which jobs get an auto-generated proposal. Jobs that fail a filter are still saved
          (visible on the Jobs page) so you can review them, but they won't get an automatic proposal.
        </p>

        <div>
          <label className="font-semibold">Excluded regions</label>
          <input
            type="text"
            className="w-full border p-2 rounded"
            placeholder="e.g. Kenya, Nigeria, Pakistan"
            value={excludedRegions}
            onChange={e => setExcludedRegions(e.target.value)}
          />
          <p className="text-xs text-gray-400 mt-1">Comma-separated country names — jobs from these client countries are skipped for auto-proposals.</p>
        </div>

        <div className="flex gap-4">
          <div className="w-1/2">
            <label>Minimum client hire rate (%)</label>
            <input type="number" min="0" max="100" className="w-full border p-2 rounded" placeholder="e.g. 50" value={minHireRate} onChange={e => setMinHireRate(e.target.value)} />
          </div>
          <div className="w-1/2">
            <label>Minimum client total spent ($)</label>
            <input type="number" min="0" className="w-full border p-2 rounded" placeholder="e.g. 1000" value={minTotalSpent} onChange={e => setMinTotalSpent(e.target.value)} />
          </div>
        </div>

        <div className="flex justify-between items-center">
          <span className="font-semibold">Require payment verified</span>
          <button
            type="button"
            onClick={() => setRequirePaymentVerified(!requirePaymentVerified)}
            className={`px-6 py-2 rounded text-white ${requirePaymentVerified ? 'bg-green-600' : 'bg-gray-400'}`}
          >
            {requirePaymentVerified ? 'ON' : 'OFF'}
          </button>
        </div>

        <button onClick={saveSettings} className="w-full bg-purple-600 text-white py-2 rounded">💾 Save Client Filters</button>
      </div>

      <div className="bg-white p-6 rounded shadow border-t-4 border-blue-400">
        <h2 className="font-semibold">🍪 Upwork Cookies</h2>
        <textarea className="w-full h-32 border p-2 rounded text-sm" placeholder='Paste JSON array of cookies' value={cookies} onChange={e => setCookies(e.target.value)} />
        <button onClick={saveCookies} className="mt-2 bg-purple-600 text-white px-4 py-2 rounded">💾 Save Cookies</button>
      </div>
    </div>
  )
}