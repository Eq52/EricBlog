import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyToken, getTokenFromHeader } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const articleId = searchParams.get('articleId')
    const global = searchParams.get('global')
    const limit = parseInt(searchParams.get('limit') || '10', 10)

    // Global query: fetch recent comments across all articles
    if (global === 'true' && !articleId) {
      const comments = await db.comment.findMany({
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 50),
        include: {
          user: {
            select: { id: true, name: true, avatar: true },
          },
          article: {
            select: { id: true, title: true },
          },
        },
      })

      return NextResponse.json({
        comments: comments.map((c) => ({
          id: c.id,
          content: c.content,
          articleId: c.articleId,
          articleTitle: c.article?.title || '',
          authorName: c.user?.name || c.guestName || '匿名',
          createdAt: c.createdAt,
        })),
      })
    }

    if (!articleId) {
      return NextResponse.json({ error: 'articleId is required' }, { status: 400 })
    }

    const comments = await db.comment.findMany({
      where: { articleId },
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: { id: true, name: true, avatar: true },
        },
      },
    })

    return NextResponse.json({ comments })
  } catch (error) {
    console.error('Get comments error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { articleId, content, parentId, guestName, guestEmail } = body

    if (!articleId || !content) {
      return NextResponse.json({ error: 'articleId and content are required' }, { status: 400 })
    }

    // Check article exists
    const article = await db.article.findUnique({ where: { id: articleId } })
    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }

    // Optionally get user from token
    const token = getTokenFromHeader(request)
    let userId: string | null = null
    if (token) {
      const payload = await verifyToken(token)
      if (payload) {
        userId = payload.userId
      }
    }

    // If no userId (guest), require guestName and guestEmail
    if (!userId) {
      if (!guestName || !guestEmail) {
        return NextResponse.json(
          { error: 'Guest comments require guestName and guestEmail' },
          { status: 400 }
        )
      }
    }

    const comment = await db.comment.create({
      data: {
        content,
        articleId,
        userId: userId || null,
        guestName: userId ? null : guestName,
        guestEmail: userId ? null : guestEmail,
        parentId: parentId || null,
      },
      include: {
        user: {
          select: { id: true, name: true, avatar: true },
        },
      },
    })

    return NextResponse.json({ comment }, { status: 201 })
  } catch (error) {
    console.error('Create comment error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/comments - 删除评论
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const commentId = searchParams.get('id')

    if (!commentId) {
      return NextResponse.json({ error: '缺少评论ID' }, { status: 400 })
    }

    // 查找评论
    const comment = await db.comment.findUnique({
      where: { id: commentId },
      include: {
        user: {
          select: { id: true },
        },
      },
    })

    if (!comment) {
      return NextResponse.json({ error: '评论不存在' }, { status: 404 })
    }

    // 鉴权：管理员可删任意，登录用户可删自己的，游客需验证邮箱
    const token = getTokenFromHeader(request)
    let isAllowed = false

    if (token) {
      const payload = await verifyToken(token)
      if (payload) {
        // 管理员可删任何评论
        if (payload.role === 'admin') {
          isAllowed = true
        }
        // 登录用户可删自己的评论
        else if (comment.userId && comment.userId === payload.userId) {
          isAllowed = true
        }
      }
    } else {
      // 游客：需要通过 query 参数提供 guestEmail 来验证身份
      const guestEmail = searchParams.get('guestEmail')
      if (guestEmail && comment.guestEmail && comment.guestEmail.toLowerCase() === guestEmail.trim().toLowerCase()) {
        isAllowed = true
      }
    }

    if (!isAllowed) {
      return NextResponse.json({ error: '无权删除此评论' }, { status: 403 })
    }

    // 删除该评论的所有回复
    await db.comment.deleteMany({
      where: { parentId: commentId },
    })

    // 删除评论本身
    await db.comment.delete({
      where: { id: commentId },
    })

    return NextResponse.json({ message: '评论已删除' })
  } catch (error) {
    console.error('Delete comment error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
