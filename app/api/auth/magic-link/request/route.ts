import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { prisma } from '@/lib/server/prisma'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { email?: string }
  const email = (body.email ?? '').trim().toLowerCase()
  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }

  const token = crypto.randomBytes(32).toString('base64url')
  const tokenHash = await bcrypt.hash(token, 12)
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000)

  await prisma.magicLinkToken.create({
    data: {
      email,
      tokenHash,
      expiresAt,
    },
  })

  return NextResponse.json({
    ok: true,
    expiresAt,
  })
}

