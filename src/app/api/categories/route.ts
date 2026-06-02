import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyToken, getTokenFromHeader } from '@/lib/auth'

// GET /api/categories — 公开，返回所有分类
export async function GET() {
  try {
    const categories = await db.category.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ categories })
  } catch (error) {
    console.error('List categories error:', error)
    return NextResponse.json({ error: '获取分类失败' }, { status: 500 })
  }
}

// POST /api/categories — 管理员创建分类
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
    const { name, description } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: '分类名称不能为空' }, { status: 400 })
    }

    const trimmed = name.trim()
    const existing = await db.category.findUnique({ where: { name: trimmed } })
    if (existing) {
      return NextResponse.json({ error: '该分类已存在' }, { status: 409 })
    }

    const category = await db.category.create({
      data: { name: trimmed, description: description || null },
    })

    return NextResponse.json({ category }, { status: 201 })
  } catch (error) {
    console.error('Create category error:', error)
    return NextResponse.json({ error: '创建分类失败' }, { status: 500 })
  }
}

// PUT /api/categories — 管理员更新分类
export async function PUT(request: NextRequest) {
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
    const { id, name, description } = body

    if (!id) {
      return NextResponse.json({ error: '缺少分类 ID' }, { status: 400 })
    }

    const existing = await db.category.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: '分类不存在' }, { status: 404 })
    }

    const updateData: Record<string, string | null> = {}
    if (name !== undefined) {
      const trimmed = name.trim()
      if (trimmed.length === 0) {
        return NextResponse.json({ error: '分类名称不能为空' }, { status: 400 })
      }
      if (trimmed !== existing.name) {
        const duplicate = await db.category.findUnique({ where: { name: trimmed } })
        if (duplicate) {
          return NextResponse.json({ error: '该分类名称已存在' }, { status: 409 })
        }
        updateData.name = trimmed
      }
    }
    if (description !== undefined) {
      updateData.description = description || null
    }

    const category = await db.category.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ category })
  } catch (error) {
    console.error('Update category error:', error)
    return NextResponse.json({ error: '更新分类失败' }, { status: 500 })
  }
}

// DELETE /api/categories — 管理员删除分类
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
      return NextResponse.json({ error: '缺少分类 ID' }, { status: 400 })
    }

    const existing = await db.category.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: '分类不存在' }, { status: 404 })
    }

    // 将使用该分类的文章 category 设为 null
    await db.article.updateMany({
      where: { category: existing.name },
      data: { category: null },
    })

    await db.category.delete({ where: { id } })
    return NextResponse.json({ message: '分类已删除' })
  } catch (error) {
    console.error('Delete category error:', error)
    return NextResponse.json({ error: '删除分类失败' }, { status: 500 })
  }
}
