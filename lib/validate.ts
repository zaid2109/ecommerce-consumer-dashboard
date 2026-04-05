import { aggregated, orders } from './data-generator'

console.assert(orders.length === 100000, 'wrong count')
console.assert(aggregated.dailyRevenue.length === 730, 'wrong daily length')
console.log('Total revenue:', aggregated.dailyRevenue.reduce((s, d) => s + d.gross, 0).toFixed(2))
console.log('Segment counts:', aggregated.segmentCounts)
