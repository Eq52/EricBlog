import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/articles/meta — 从 Category/Tag 表返回分类和标签
// 回退：如果表为空则从已发布文章中提取并自动填充
export async function GET() {
  try {
    let categories = await db.category.findMany({ orderBy: { name: 'asc' } })
    let tags = await db.tag.findMany({ orderBy: { name: 'asc' } })

    // 如果没有任何分类/标签记录，从现有文章中初始化
    if (categories.length === 0 && tags.length === 0) {
      const articles = await db.article.findMany({
        where: { status: 'published' },
        select: { category: true, tags: true },
      })

      const categorySet = new Set<string>()
      const tagSet = new Set<string>()

      for (const article of articles) {
        if (article.category) {
          categorySet.add(article.category)
        }
        if (article.tags) {
          try {
            const parsed: unknown[] = JSON.parse(article.tags)
            if (Array.isArray(parsed)) {
              for (const tag of parsed) {
                if (typeof tag === 'string' && tag.trim()) {
                  tagSet.add(tag.trim())
                }
              }
            }
          } catch { /* ignore */ }
        }
      }

      // 批量写入 Category 表
      for (const name of categorySet) {
        await db.category.create({ data: { name } }).catch(() => {})
      }
      // 批量写入 Tag 表
      for (const name of tagSet) {
        await db.tag.create({ data: { name } }).catch(() => {})
      }

      categories = await db.category.findMany({ orderBy: { name: 'asc' } })
      tags = await db.tag.findMany({ orderBy: { name: 'asc' } })
    }

    return NextResponse.json({
      categories: categories.map((c) => c.name),
      tags: tags.map((t) => t.name),
    })
  } catch (error) {
    console.error('Articles meta error:', error)
    return NextResponse.json({ error: '获取分类标签失败' }, { status: 500 })
  }
}
