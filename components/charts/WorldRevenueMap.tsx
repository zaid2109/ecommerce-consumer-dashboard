'use client'

import { useMemo, useState } from 'react'
import { ComposableMap, Geographies, Geography } from 'react-simple-maps'
import { formatCurrency, formatNumber, interpolateColor } from '@/lib/utils'

type CountryRevenueDatum = {
  country: string
  revenue: number
  orders: number
}

type WorldRevenueMapProps = {
  data: CountryRevenueDatum[]
}

type HoverState = (CountryRevenueDatum & { hasData: true }) | { country: string; hasData: false } | null
type GeoFeature = { rsmKey: string; properties: { [key: string]: string | undefined } }

const GEO_URL = 'https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson'

function canonicalCountryName(name: string): string {
  const normalized = name.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
  if (normalized === 'tajiikstan') return 'tajikistan'
  if (normalized === 'usa' || normalized === 'us' || normalized === 'unitedstates' || normalized === 'unitedstatesofamerica') return 'unitedstates'
  if (normalized === 'uk' || normalized === 'unitedkingdom' || normalized === 'greatbritain') return 'unitedkingdom'
  if (normalized === 'uae' || normalized === 'unitedarabemirates') return 'unitedarabemirates'
  if (normalized === 'ivorycoast' || normalized === 'cotedivoire') return 'cotedivoire'
  if (normalized === 'turkiye' || normalized === 'turkey') return 'turkey'
  if (normalized === 'eswatini' || normalized === 'swaziland') return 'eswatini'
  if (normalized === 'myanmar' || normalized === 'burma') return 'myanmar'
  if (normalized === 'moldova' || normalized === 'moldovarepublicof') return 'moldova'
  if (normalized === 'bolivia' || normalized === 'boliviaplurinationalstateof') return 'bolivia'
  if (normalized === 'venezuela' || normalized === 'venezuelabolivarianrepublicof') return 'venezuela'
  if (normalized === 'russia' || normalized === 'russianfederation') return 'russia'
  if (normalized === 'southkorea' || normalized === 'korearepublicof') return 'southkorea'
  if (normalized === 'northkorea' || normalized === 'koreademocraticpeoplesrepublicof') return 'northkorea'
  if (normalized === 'czechrepublic' || normalized === 'czechia') return 'czechia'
  return normalized
}

function getGeoCountryName(geo: GeoFeature): string {
  const p = geo.properties
  return (
    p.NAME ??
    p.name ??
    p.ADMIN ??
    p.NAME_LONG ??
    p.BR_NAME ??
    p.FORMAL_EN ??
    ''
  )
}

export default function WorldRevenueMap({ data }: WorldRevenueMapProps) {
  const [hovered, setHovered] = useState<HoverState>(null)

  const lookup = useMemo(() => {
    const table = new Map<string, CountryRevenueDatum>()
    for (const row of data) {
      table.set(canonicalCountryName(row.country), row)
    }
    return table
  }, [data])

  const [minRevenue, maxRevenue] = useMemo(() => {
    if (data.length === 0) return [0, 0]
    let min = Number.POSITIVE_INFINITY
    let max = 0
    for (const row of data) {
      min = Math.min(min, row.revenue)
      max = Math.max(max, row.revenue)
    }
    return [min, max]
  }, [data])

  return (
    <div className="relative">
      <div className="h-[560px] w-full overflow-hidden rounded-xl border border-[#243252] bg-gradient-to-b from-[#0b142a] to-[#090f1f] p-2">
        <ComposableMap projectionConfig={{ scale: 155 }} className="h-full w-full">
          <Geographies geography={GEO_URL}>
            {({ geographies }: { geographies: GeoFeature[] }) =>
              geographies.map((geo) => {
                const geoName = String(getGeoCountryName(geo))
                const row = lookup.get(canonicalCountryName(geoName))
                const fill = row
                  ? interpolateColor(row.revenue, minRevenue, maxRevenue, '#14b8a6', '#8b5cf6')
                  : '#1b2438'

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onMouseEnter={() =>
                      setHovered(
                        row
                          ? { country: row.country, revenue: row.revenue, orders: row.orders, hasData: true }
                          : { country: geoName, hasData: false }
                      )
                    }
                    onMouseLeave={() => setHovered(null)}
                    style={{
                      default: { fill, outline: 'none', stroke: '#334155', strokeWidth: 0.45 },
                      hover: { fill: row ? '#c4b5fd' : '#293548', outline: 'none', stroke: '#94a3b8', strokeWidth: 0.7 },
                      pressed: { fill: row ? '#c4b5fd' : '#334155', outline: 'none' },
                    }}
                  />
                )
              })
            }
          </Geographies>
        </ComposableMap>
      </div>

      <div className="pointer-events-none absolute left-4 top-4 rounded-md border border-[#2b3a59] bg-[#0b1222]/90 px-3 py-2 text-[12px] text-slate-200 backdrop-blur-sm">
        {hovered ? (
          hovered.hasData ? (
            <div className="space-y-0.5">
              <div className="font-semibold">{hovered.country}</div>
              <div className="text-slate-300">{formatNumber(hovered.orders)} orders</div>
              <div className="font-semibold text-white">{formatCurrency(hovered.revenue)}</div>
            </div>
          ) : (
            <div className="space-y-0.5">
              <div className="font-semibold">{hovered.country || 'Country'}</div>
              <div className="text-slate-300">No matching dataset revenue</div>
            </div>
          )
        ) : (
          <span className="text-slate-300">Hover countries to inspect revenue</span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-[12px] text-tx-secondary dark:text-tx-muted">
        <span className="pill bg-accent/10 text-accent">{data.length} active countries</span>
        <span>Min: {formatCurrency(minRevenue)}</span>
        <span>Max: {formatCurrency(maxRevenue)}</span>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[11px]">Low</span>
          <div className="h-2 w-24 rounded-full bg-gradient-to-r from-[#14b8a6] to-[#8b5cf6]" />
          <span className="text-[11px]">High</span>
        </div>
      </div>
    </div>
  )
}

