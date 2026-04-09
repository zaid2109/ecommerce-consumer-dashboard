import fs from 'fs/promises'
import path from 'path'

type BuildManifest = {
  pages?: Record<string, string[]>
  app?: Record<string, string[]>
}

const NEXT_DIR = path.join(process.cwd(), '.next')
const MANIFEST_PATH = path.join(NEXT_DIR, 'build-manifest.json')
const BUDGET_BYTES = Number(process.env.BUNDLE_BUDGET_BYTES ?? 320_000)

async function fileSize(filePath: string): Promise<number> {
  try {
    const stat = await fs.stat(filePath)
    return stat.size
  } catch {
    return 0
  }
}

async function main() {
  const manifestRaw = await fs.readFile(MANIFEST_PATH, 'utf8')
  const manifest = JSON.parse(manifestRaw) as BuildManifest
  const allAssets = new Set<string>()

  for (const chunkList of Object.values(manifest.pages ?? {})) {
    for (const asset of chunkList) allAssets.add(asset)
  }
  for (const chunkList of Object.values(manifest.app ?? {})) {
    for (const asset of chunkList) allAssets.add(asset)
  }

  let totalJsBytes = 0
  for (const asset of allAssets) {
    if (!asset.endsWith('.js')) continue
    const absolute = path.join(NEXT_DIR, asset)
    totalJsBytes += await fileSize(absolute)
  }

  console.log(`Bundle JS total: ${totalJsBytes} bytes (budget: ${BUDGET_BYTES} bytes)`)
  if (totalJsBytes > BUDGET_BYTES) {
    throw new Error(`Bundle budget exceeded by ${totalJsBytes - BUDGET_BYTES} bytes`)
  }
}

main().catch((error) => {
  console.error('❌ Bundle budget check failed')
  console.error(error)
  process.exit(1)
})
