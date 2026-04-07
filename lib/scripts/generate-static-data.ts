import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

// Import the generator (runs synchronously)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { aggregated, orders } = require('../data-generator')

const outputDir = join(process.cwd(), 'public', 'data')
const outputPath = join(outputDir, 'aggregated.json')
const ordersPath = join(outputDir, 'orders.json')

mkdirSync(outputDir, { recursive: true })
writeFileSync(outputPath, JSON.stringify(aggregated), 'utf-8')
writeFileSync(ordersPath, JSON.stringify(orders), 'utf-8')

console.log(`✓ Static data written to public/data/aggregated.json`)
console.log(`✓ Static data written to public/data/orders.json`)
console.log(`  Daily revenue entries: ${aggregated.dailyRevenue.length}`)
console.log(`  Top products: ${aggregated.topProducts.length}`)
