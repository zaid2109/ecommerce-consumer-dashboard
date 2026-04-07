import fs from 'fs/promises'
import path from 'path'

const ARTIFACT_ROOT = path.join(process.cwd(), '.artifacts')

function toSafePath(key: string): string {
  const normalized = key.replace(/\\/g, '/').replace(/\.\./g, '').replace(/^\/+/, '')
  return path.join(ARTIFACT_ROOT, normalized)
}

export async function writeJsonArtifact(key: string, payload: unknown): Promise<void> {
  const filePath = toSafePath(key)
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(payload), 'utf8')
}

export async function readJsonArtifact<T>(key: string): Promise<T | null> {
  try {
    const filePath = toSafePath(key)
    const content = await fs.readFile(filePath, 'utf8')
    return JSON.parse(content) as T
  } catch {
    return null
  }
}

