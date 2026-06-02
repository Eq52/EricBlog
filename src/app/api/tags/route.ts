import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyToken, getTokenFromHeader } from '@/lib/auth'

// GET /api/tags — 公开，返回所有标签
export async function GET() {
  try {
    const tags = await db.tag.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ tags })
  } catch (error) {
    console.error('List tags error:', error)
    return NextResponse.json({ error: '获取标签失败' }, { status: 500 })
  }
}

// POST /api/tags — 管理员创建标签（支持单个或批量）
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
    const { name, names } = body

    // 支持批量创建
    const inputNames: string[] = names
      ? (Array.isArray(names) ? names : [names])
      : name
        ? [name]
        : []

    if (inputNames.length === 0) {
      return NextResponse.json({ error: '标签名称不能为空' }, { status: 400 })
    }

    const trimmedNames = inputNames.map((n: unknown) => String(n).trim()).filter((n: string) => n.length > 0)
    const created: { id: string; name: string }[] = []
    const skipped: string[] = []

    for (const n of trimmedNames) {
      const existing = await db.tag.findUnique({ where: { name: n } })
      if (existing) {
        skipped.push(n)
      } else {
        const tag = await db.tag.create({ data: { name: n } })
        created.push({ id: tag.id, name: tag.name })
      }
    }

    return NextResponse.json({ created, skipped }, { status: 201 })
  } catch (error) {
    console.error('Create tag error:', error)
    return NextResponse.json({ error: '创建标签失败' }, { status: 500 })
  }
}

// DELETE /api/tags — 管理员删除标签
export async function DELETE(request: NextRequest) {
  try {
    const token = getTokenFromHeader(request)
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const payload = await verifyToken(token)
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: '缺少标签 ID' }, { status: 400 })
    }

    const existing = await db.tag.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: '标签不存在' }, { status: 404 })
    }

    // 从所有文章的 tags JSON 中移除该标签
    const articles = await db.article.findMany({
      where: { tags: { contains: existing.name } },
      select: { id: true, tags: true },
    })

    for (const article of articles) {
      try {
        const parsed: string[] = JSON.parse(article.tags)
        const filtered = parsed.filter((t) => t !== existing.name)
        await db.article.update({
          where: { id: article.id },
          data: { tags: JSON.stringify(filtered) },
        })
      } catch {
        // 忽略解析失败的 tags
      }
    }

    await db.tag.delete({ where: { id } })
    return NextResponse.json({ message: '标签已删除' })
  } catch (error) {
    console.error('Delete tag error:', error)
    return NextResponse.json({ error: '删除标签失败' }, { status: 500 })
  }
}
