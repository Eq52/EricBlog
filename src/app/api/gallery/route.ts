import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { promises as fs } from 'fs'
import path from 'path'

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads')

/**
 * 根据 URL 删除本地文件（如果是本地上传的图片）
 * 仅处理 /uploads/ 开头的路径，忽略外部 URL
 */
async function deleteLocalFile(url: string) {
  if (!url || !url.startsWith('/uploads/')) return
  const fileName = url.replace('/uploads/', '')
  // 安全检查：防止路径穿越
  if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) return
  const filePath = path.join(UPLOAD_DIR, fileName)
  try {
    await fs.unlink(filePath)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error('Failed to delete local file:', err)
    }
  }
}

// GET /api/gallery - 获取所有画廊图片
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const tag = searchParams.get('tag')

    const where: Record<string, unknown> = {}
    if (tag && tag !== '全部' && tag !== '') {
      where.tag = tag
    }

    const images = await db.galleryImage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        author: {
          select: { id: true, name: true },
        },
      },
    })

    // 获取所有已使用的标签
    const allTags = await db.galleryImage.findMany({
      select: { tag: true },
      distinct: ['tag'],
      where: { tag: { not: '' } },
    })

    const tags = ['全部', ...allTags.map((t) => t.tag)]

    return NextResponse.json({
      images: images.map((img) => ({
        id: img.id,
        url: img.url,
        title: img.title,
        tag: img.tag,
        createdAt: img.createdAt,
      })),
      tags,
    })
  } catch (error) {
    console.error('Gallery GET error:', error)
    return NextResponse.json({ error: '获取画廊失败' }, { status: 500 })
  }
}

// POST /api/gallery - 上传画廊图片（仅管理员）
export async function POST(request: NextRequest) {
  try {
    // 验证管理员身份
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    const token = authHeader.slice(7)
    const payload = await verifyToken(token)
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: '权限不足，仅管理员可上传' }, { status: 403 })
    }

    const body = await request.json()
    const { url, title, tag } = body

    if (!url) {
      return NextResponse.json({ error: '图片URL不能为空' }, { status: 400 })
    }

    const image = await db.galleryImage.create({
      data: {
        url,
        title: title || '',
        tag: tag || '',
        authorId: payload.userId,
      },
    })

    return NextResponse.json({
      image: {
        id: image.id,
        url: image.url,
        title: image.title,
        tag: image.tag,
        createdAt: image.createdAt,
      },
      message: '图片添加成功',
    }, { status: 201 })
  } catch (error) {
    console.error('Gallery POST error:', error)
    return NextResponse.json({ error: '添加图片失败' }, { status: 500 })
  }
}

// DELETE /api/gallery - 删除画廊图片（仅管理员）
export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    const token = authHeader.slice(7)
    const payload = await verifyToken(token)
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: '缺少图片ID' }, { status: 400 })
    }

    const image = await db.galleryImage.findUnique({ where: { id } })
    if (!image) {
      return NextResponse.json({ error: '图片不存在' }, { status: 404 })
    }

    // 删除本地文件（如果是本地上传的图片）
    await deleteLocalFile(image.url)

    await db.galleryImage.delete({ where: { id } })

    return NextResponse.json({ message: '图片已删除' })
  } catch (error) {
    console.error('Gallery DELETE error:', error)
    return NextResponse.json({ error: '删除失败' }, { status: 500 })
  }
}
