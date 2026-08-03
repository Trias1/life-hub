"use client"

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="page-container"><div className="empty-state surface" role="alert"><p className="eyebrow text-red-600">Something went wrong</p><h1 className="mt-2 text-xl font-semibold">This workspace could not load.</h1><p>Try again, or return to the dashboard if the problem continues.</p><button type="button" onClick={() => reset()} className="button-primary mt-5">Try again</button></div></div>
}
