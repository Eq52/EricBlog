import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyToken, getTokenFromHeader, createToken } from '@/lib/auth'
import { writeMdFile, listMdFiles, readArticleContent } from '@/lib/md-files'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const search = searchParams.get('search')
    const tag = searchParams.get('tag')
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '12', 10)
    const source = searchParams.get('source') // 'md' | 'db' | undefined

    const skip = (page - 1) * limit

    // Check if admin (can see all articles)
    const token = getTokenFromHeader(request)
    let isAdmin = false
    if (token) {
      const payload = await verifyToken(token)
      if (payload && payload.role === 'admin') isAdmin = true
    }

    // === source=md 模式：从本地 .md 文件加载文章 ===
    if (source === 'md') {
      const mdFiles = await listMdFiles()
      let items = mdFiles.map((md) => ({
        id: md.fileName.replace('.md', ''),
        title: md.frontmatter.title || '无标题',
        slug: md.frontmatter.slug || md.fileName.replace('.md', ''),
        content: md.content,
        summary: md.frontmatter.summary || null,
        category: md.frontmatter.category || null,
        tags: md.frontmatter.tags ? JSON.stringify(md.frontmatter.tags) : '[]',
        coverImage: md.frontmatter.coverImage || null,
        visibility: md.frontmatter.visibility || 'public',
        status: md.frontmatter.status || 'draft',
        viewCount: 0,
        likeCount: 0,
        createdAt: md.frontmatter.createdAt ? new Date(md.frontmatter.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: md.frontmatter.updatedAt ? new Date(md.frontmatter.updatedAt).toISOString() : new Date().toISOString(),
        author: { id: 'system', name: 'Admin', avatar: null },
      }))

      // 权限过滤
      if (!isAdmin) {
        items = items.filter(
          (a) => a.status === 'published' && a.visibility === 'public'
        )
      }

      // 分类过滤
      if (category) {
        items = items.filter((a) => a.category === category)
      }

      // 标签过滤
      if (tag) {
        items = items.filter((a) => a.tags.includes(tag))
      }

      // 搜索过滤
      if (search) {
        const s = search.toLowerCase()
        items = items.filter(
          (a) =>
            a.title.toLowerCase().includes(s) ||
            a.content.toLowerCase().includes(s) ||
            (a.summary && a.summary.toLowerCase().includes(s))
        )
      }

      // 排序
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

      const total = items.length
      const totalPages = Math.ceil(total / limit)
      const articles = items.slice(skip, skip + limit)

      return NextResponse.json({ articles, total, page, totalPages })
    }

    // === 默认模式：数据库查询 ===
    const where: Record<string, unknown> = isAdmin
      ? {}
      : {
          status: 'published',
          visibility: 'public',
        }

    if (category) {
      where.category = category
    }

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { content: { contains: search } },
        { summary: { contains: search } },
      ]
    }

    if (tag) {
      where.tags = { contains: tag }
    }

    const [articles, total] = await Promise.all([
      db.article.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          author: {
            select: { id: true, name: true, avatar: true },
          },
        },
      }),
      db.article.count({ where }),
    ])

    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      articles,
      total,
      page,
      totalPages,
    })
  } catch (error) {
    console.error('List articles error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = getTokenFromHeader(request)
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { title, content, summary, category, tags, coverImage, visibility, status } = body

    if (!title || !content) {
      return NextResponse.json({ error: 'Title and content are required' }, { status: 400 })
    }

    // Generate slug
    const slug =
      title
        .toLowerCase()
        .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
        .replace(/^-|-$/g, '') +
      '-' +
      Date.now().toString(36)

    const tagsArr = Array.isArray(tags) ? tags : []
    const tagsStr = JSON.stringify(tagsArr)

    // 同步分类到 Category 表（upsert）
    if (category && typeof category === 'string' && category.trim()) {
      await db.category.upsert({
        where: { name: category.trim() },
        create: { name: category.trim() },
        update: {},
      }).catch(() => {})
    }

    // 同步标签到 Tag 表（upsert）
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

    const article = await db.article.create({
      data: {
        title,
        slug,
        content,
        summary: summary || null,
        category: category || null,
        tags: tagsStr,
        coverImage: coverImage || null,
        visibility: visibility || 'public',
        status: status || 'draft',
        authorId: payload.userId,
      },
      include: {
        author: {
          select: { id: true, name: true, avatar: true },
        },
      },
    })

    // 同步写入 .md 文件
    try {
      await writeMdFile(slug, {
        title,
        category: category || undefined,
        tags: tagsArr.length > 0 ? tagsArr : undefined,
        summary: summary || undefined,
        coverImage: coverImage || undefined,
        status: status || 'draft',
        visibility: visibility || 'public',
        createdAt: article.createdAt.toISOString(),
        updatedAt: article.updatedAt.toISOString(),
      }, content)
    } catch (err) {
      console.error('Failed to write .md file:', err)
      // .md 文件写入失败不影响文章创建
    }

    return NextResponse.json({ article }, { status: 201 })
  } catch (error) {
    console.error('Create article error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
