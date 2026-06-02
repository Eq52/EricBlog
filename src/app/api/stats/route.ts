import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/stats - 获取站点统计（文章数、评论数、浏览量）
export async function GET() {
  try {
    const [articleCount, publishedCount, commentCount, totalViews, siteCreated] =
      await Promise.all([
        db.article.count(),
        db.article.count({ where: { status: 'published' } }),
        db.comment.count(),
        db.article.aggregate({ _sum: { viewCount: true } }),
        db.siteSetting.findUnique({ where: { key: 'site_created_at' } }),
      ])

    return NextResponse.json({
      articles: articleCount,
      published: publishedCount,
      comments: commentCount,
      totalViews: totalViews._sum.viewCount || 0,
      siteCreatedAt: siteCreated?.value || null,
    })
  } catch (error) {
    console.error('Stats error:', error)
    return NextResponse.json({ error: '获取统计失败' }, { status: 500 })
  }
}
