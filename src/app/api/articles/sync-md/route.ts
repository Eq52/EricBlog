import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyToken, getTokenFromHeader } from '@/lib/auth'
import { listMdFiles } from '@/lib/md-files'

/**
 * POST /api/articles/sync-md
 * 扫描 content/ 目录下的 .md 文件，自动导入到数据库中
 * 仅管理员可调用
 *
 * 对于每个 .md 文件：
 * - 如果 slug 已存在于 DB → 跳过（不覆盖已有内容）
 * - 如果 slug 不存在 → 创建新 Article 记录
 */
export async function POST(request: NextRequest) {
  try {
    // 验证管理员权限
    const token = getTokenFromHeader(request)
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const payload = await verifyToken(token)
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const mdFiles = await listMdFiles()
    let imported = 0
    let skipped = 0
    const errors: string[] = []

    // 获取当前管理员 ID（用于 authorId）
    const adminId = payload.userId

    for (const md of mdFiles) {
      if (!md.frontmatter.title) {
        errors.push(`${md.fileName}: 缺少标题，跳过`)
        skipped++
        continue
      }

      // 从文件名提取 slug（去掉 .md 后缀）
      const slug = md.fileName.replace(/\.md$/, '')

      // 检查 slug 是否已存在于 DB
      const existing = await db.article.findFirst({ where: { slug } })
      if (existing) {
        skipped++
        continue
      }

      // 解析 tags
      const tags = md.frontmatter.tags || []
      const tagsStr = JSON.stringify(tags)

      // 解析日期
      const createdAt = md.frontmatter.createdAt
        ? new Date(md.frontmatter.createdAt)
        : new Date()

      try {
        await db.article.create({
          data: {
            title: md.frontmatter.title,
            slug,
            content: md.content,
            summary: md.frontmatter.summary || null,
            category: md.frontmatter.category || null,
            tags: tagsStr,
            coverImage: md.frontmatter.coverImage || null,
            visibility: md.frontmatter.visibility || 'public',
            status: md.frontmatter.status || 'published',
            authorId: adminId,
            createdAt,
          },
        })

        // 同步分类到 Category 表
        if (md.frontmatter.category) {
          await db.category
            .upsert({
              where: { name: md.frontmatter.category },
              create: { name: md.frontmatter.category },
              update: {},
            })
            .catch(() => {})
        }

        // 同步标签到 Tag 表
        for (const tagName of tags) {
          const trimmed = String(tagName).trim()
          if (trimmed) {
            await db.tag
              .upsert({
                where: { name: trimmed },
                create: { name: trimmed },
                update: {},
              })
              .catch(() => {})
          }
        }

        imported++
      } catch (err) {
        errors.push(`${md.fileName}: 导入失败 - ${(err as Error).message}`)
        skipped++
      }
    }

    return NextResponse.json({
      message: 'MD 文件同步完成',
      total: mdFiles.length,
      imported,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('Sync MD files error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * GET /api/articles/sync-md
 * 返回当前 content/ 目录中 .md 文件的概览信息
 * 不需要管理员权限（仅返回数量和文件名列表）
 */
export async function GET() {
  try {
    const mdFiles = await listMdFiles()
    const overview = mdFiles.map((md) => ({
      fileName: md.fileName,
      title: md.frontmatter.title || '无标题',
      category: md.frontmatter.category || null,
      status: md.frontmatter.status || 'draft',
    }))

    return NextResponse.json({
      total: mdFiles.length,
      files: overview,
    })
  } catch (error) {
    console.error('List MD files error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
