export default function DashboardLoading() {
  return (
    <div className="space-y-5 p-6 animate-pulse">
      {/* KPI row skeleton */}
      <div className="grid grid-cols-4 gap-5">
        {[...Array(4)].map((_, i) => (
          <div key={i} style={{
            background:'#1e2433', borderRadius:10, height:110,
          }} />
        ))}
      </div>
      {/* Chart row skeleton */}
      <div className="grid grid-cols-5 gap-5">
        <div style={{ gridColumn:'span 3', background:'#1e2433', borderRadius:10, height:280 }} />
        <div style={{ gridColumn:'span 2', background:'#1e2433', borderRadius:10, height:280 }} />
      </div>
      {/* Wide skeleton */}
      <div style={{ background:'#1e2433', borderRadius:10, height:200 }} />
    </div>
  )
}
