import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyToken, getTokenFromHeader } from '@/lib/auth'
import { readArticleContent, writeMdFile, deleteMdFile, mdFileExists } from '@/lib/md-files'
import { promises as fs } from 'fs'
import path from 'path'

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads')

/** 根据 URL 删除本地文件（仅 /uploads/ 开头） */
async function deleteLocalFile(url: string) {
  if (!url || !url.startsWith('/uploads/')) return
  const fileName = url.replace('/uploads/', '')
  if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) return
  try {
    await fs.unlink(path.join(UPLOAD_DIR, fileName))
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') console.error('Failed to delete local file:', err)
  }
}

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const token = getTokenFromHeader(request)
    let userPayload: { userId: string; role: string } | null = null

    if (token) {
      userPayload = await verifyToken(token)
    }

    const article = await db.article.findUnique({
      where: { id },
      include: {
        author: {
          select: { id: true, name: true, avatar: true, bio: true },
        },
        comments: {
          include: {
            user: {
              select: { id: true, name: true, avatar: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }

    // Only admins can see drafts
    if (article.status !== 'published') {
      if (!userPayload || userPayload.role !== 'admin') {
        return NextResponse.json({ error: 'Article not found' }, { status: 404 })
      }
    }

    // Check visibility
    if (article.visibility === 'private') {
      if (!userPayload || userPayload.role !== 'admin') {
        return NextResponse.json({ error: 'Article not found' }, { status: 404 })
      }
    } else if (article.visibility === 'auth_only') {
      if (!userPayload) {
        return NextResponse.json({ error: 'Login required to view this article' }, { status: 401 })
      }
    }

    // Increment view count
    await db.article.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    })

    // 优先从 .md 文件读取文章内容
    if (article.slug) {
      const mdContent = await readArticleContent(article.slug, article.content)
      article.content = mdContent
    }

    return NextResponse.json({ article })
  } catch (error) {
    console.error('Get article error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const token = getTokenFromHeader(request)
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { id } = await context.params
    const body = await request.json()
    const { title, content, summary, category, tags, coverImage, visibility, status } = body

    // Check article exists
    const existing = await db.article.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (title !== undefined) updateData.title = title
    if (content !== undefined) updateData.content = content
    if (summary !== undefined) updateData.summary = summary
    if (category !== undefined) updateData.category = category
    if (tags !== undefined) updateData.tags = Array.isArray(tags) ? JSON.stringify(tags) : tags
    if (coverImage !== undefined) updateData.coverImage = coverImage
    if (visibility !== undefined) updateData.visibility = visibility
    if (status !== undefined) updateData.status = status

    // 同步分类到 Category 表（upsert）
    if (category !== undefined && typeof category === 'string' && category.trim()) {
      await db.category.upsert({
        where: { name: category.trim() },
        create: { name: category.trim() },
        update: {},
      }).catch(() => {})
    }

    // 同步标签到 Tag 表（upsert）
    if (tags !== undefined) {
      const tagsArr = Array.isArray(tags) ? tags : []
      for (const tagName of tagsArr) {
        const trimmed = String(tagName).trim()
        if (trimmed) {
          await db.tag.upsert({
            where: { name: trimmed },
            create: { name: trimmed },
            update: {},
          }).catch(() => {})
        }
      }
    }

    // Regenerate slug if title changed
    if (title !== undefined) {
      // 如果标题变更，删除旧的 .md 文件
      if (existing.slug) {
        await deleteMdFile(existing.slug).catch(() => {})
      }
      updateData.slug =
        title
          .toLowerCase()
          .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
          .replace(/^-|-$/g, '') +
        '-' +
        Date.now().toString(36)
    }

    const article = await db.article.update({
      where: { id },
      data: updateData,
      include: {
        author: {
          select: { id: true, name: true, avatar: true },
        },
      },
    })

    // 同步更新 .md 文件
    if (article.slug) {
      try {
        const tagsArr = Array.isArray(tags) ? tags : []
        await writeMdFile(article.slug, {
          title: article.title,
          category: article.category || undefined,
          tags: tagsArr.length > 0 ? tagsArr : undefined,
          summary: article.summary || undefined,
          coverImage: article.coverImage || undefined,
          status: article.status || 'draft',
          visibility: article.visibility || 'public',
          createdAt: existing.createdAt.toISOString(),
          updatedAt: new Date().toISOString(),
        }, content || existing.content)
      } catch (err) {
        console.error('Failed to update .md file:', err)
      }
    }

    return NextResponse.json({ article })
  } catch (error) {
    console.error('Update article error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const token = getTokenFromHeader(request)
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { id } = await context.params

    // Check article exists
    const existing = await db.article.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }

    // 删除关联的 .md 文件
    if (existing.slug) {
      await deleteMdFile(existing.slug).catch(() => {})
    }

    // 删除本地上传的封面图片
    if (existing.coverImage) {
      await deleteLocalFile(existing.coverImage)
    }

    // 扫描文章内容中的本地上传图片并删除
    if (existing.content) {
      const imgRegex = /!\[.*?\]\(\/uploads\/([^)]+)\)/g
      let match
      while ((match = imgRegex.exec(existing.content)) !== null) {
        await deleteLocalFile(`/uploads/${match[1]}`)
      }
    }

    // Delete associated comments first, then article
    await db.comment.deleteMany({ where: { articleId: id } })
    await db.article.delete({ where: { id } })

    return NextResponse.json({ message: 'Article deleted successfully' })
  } catch (error) {
    console.error('Delete article error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
