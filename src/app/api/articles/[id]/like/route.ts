import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyToken, getTokenFromHeader } from '@/lib/auth'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const token = getTokenFromHeader(request)

    // Find article
    const article = await db.article.findUnique({ where: { id } })
    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }

    if (!token) {
      // Guest like: just increment
      const updated = await db.article.update({
        where: { id },
        data: { likeCount: { increment: 1 } },
      })
      return NextResponse.json({ likeCount: updated.likeCount })
    }

    // Logged-in user: simple toggle (increment only, no tracking per user for simplicity)
    const updated = await db.article.update({
      where: { id },
      data: { likeCount: { increment: 1 } },
    })

    return NextResponse.json({ likeCount: updated.likeCount })
  } catch (error) {
    console.error('Like article error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
