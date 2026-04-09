import fs from 'fs/promises'
import path from 'path'
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'

const ARTIFACT_ROOT = path.join(process.cwd(), '.artifacts')
const STORAGE_PROVIDER = (process.env.ARTIFACT_STORAGE_PROVIDER ?? 'filesystem').trim().toLowerCase()

type ArtifactProvider = 'filesystem' | 's3'

function getProvider(): ArtifactProvider {
  if (STORAGE_PROVIDER === 's3' || STORAGE_PROVIDER === 'minio') return 's3'
  return 'filesystem'
}

function normalizeKey(key: string): string {
  return key.replace(/\\/g, '/').replace(/\.\./g, '').replace(/^\/+/, '')
}

function toSafePath(key: string): string {
  return path.join(ARTIFACT_ROOT, normalizeKey(key))
}

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing required artifact storage env: ${name}`)
  }
  return value
}

function createS3Client(): S3Client {
  const endpoint = process.env.ARTIFACT_S3_ENDPOINT?.trim()
  const accessKeyId = required('ARTIFACT_S3_ACCESS_KEY_ID')
  const secretAccessKey = required('ARTIFACT_S3_SECRET_ACCESS_KEY')
  const region = process.env.ARTIFACT_S3_REGION?.trim() || 'us-east-1'
  const forcePathStyle = (process.env.ARTIFACT_S3_FORCE_PATH_STYLE ?? 'true').trim().toLowerCase() === 'true'

  return new S3Client({
    region,
    endpoint: endpoint || undefined,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle,
  })
}

function bucketName(): string {
  return required('ARTIFACT_S3_BUCKET')
}

async function writeJsonFilesystem(key: string, payload: unknown): Promise<void> {
  const filePath = toSafePath(key)
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(payload), 'utf8')
}

async function readJsonFilesystem<T>(key: string): Promise<T | null> {
  try {
    const filePath = toSafePath(key)
    const content = await fs.readFile(filePath, 'utf8')
    return JSON.parse(content) as T
  } catch {
    return null
  }
}

async function writeJsonS3(key: string, payload: unknown): Promise<void> {
  const client = createS3Client()
  const normalizedKey = normalizeKey(key)
  await client.send(
    new PutObjectCommand({
      Bucket: bucketName(),
      Key: normalizedKey,
      Body: JSON.stringify(payload),
      ContentType: 'application/json; charset=utf-8',
    })
  )
}

async function readJsonS3<T>(key: string): Promise<T | null> {
  try {
    const client = createS3Client()
    const normalizedKey = normalizeKey(key)
    const object = await client.send(
      new GetObjectCommand({
        Bucket: bucketName(),
        Key: normalizedKey,
      })
    )
    const text = await object.Body?.transformToString()
    if (!text) return null
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

export async function writeJsonArtifact(key: string, payload: unknown): Promise<void> {
  if (getProvider() === 's3') {
    await writeJsonS3(key, payload)
    return
  }
  await writeJsonFilesystem(key, payload)
}

export async function readJsonArtifact<T>(key: string): Promise<T | null> {
  if (getProvider() === 's3') {
    return readJsonS3<T>(key)
  }
  return readJsonFilesystem<T>(key)
}
