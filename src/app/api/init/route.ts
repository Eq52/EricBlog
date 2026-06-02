import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword, createToken } from '@/lib/auth'
import { writeMdFile, listMdFiles } from '@/lib/md-files'

async function initAdmin(body: Record<string, string>) {
  try {
    // 使用默认值：admin@admin.com / 1029384756 / Eric
    const email = (body.email || 'admin@admin.com').trim()
    const password = body.password || '1029384756'
    const name = (body.name || 'Eric').trim()

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    // Check if any admin already exists
    const existingAdmin = await db.user.findFirst({ where: { role: 'admin' } })
    if (existingAdmin) {
      return NextResponse.json(
        { error: 'Admin account already exists. Initialization can only be done once.' },
        { status: 400 }
      )
    }

    // Check if email is already taken
    const existingUser = await db.user.findUnique({ where: { email: email.toLowerCase() } })
    if (existingUser) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 400 })
    }

    // Hash password and create admin
    const hashedPassword = await hashPassword(password)
    const admin = await db.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        name: name.trim(),
        role: 'admin',
      },
    })

    // Create default "Hello World!" article
    const defaultSlug = 'hello-world-' + Date.now().toString(36)
    await db.article.create({
      data: {
        title: 'Hello World!',
        slug: defaultSlug,
        content: `# Hello World!

Welcome to Eric Blog. This is the first article, automatically created when the blog was initialized.

## What is this blog about?

This is a personal blog built with Next.js, where I share my thoughts on technology, life, and creative projects. Feel free to explore the articles and leave a comment!

## Quick Start

- **Write articles** - Use the admin panel to create and publish articles
- **Upload images** - The built-in image hosting makes it easy to add images
- **AI assistant** - Use AI to help generate titles, summaries, and tags

Enjoy reading!`,
        summary: 'Welcome to Eric Blog! This is the first article, automatically created when the blog was initialized.',
        category: '其他',
        tags: JSON.stringify([]),
        visibility: 'public',
        status: 'published',
        authorId: admin.id,
      },
    })

    // 记录站点创建时间（运行天数起点）
    await db.siteSetting.upsert({
      where: { key: 'site_created_at' },
      create: { key: 'site_created_at', value: new Date().toISOString() },
      update: {},
    })

    // 同步默认文章的分类到 Category 表
    await db.category.upsert({
      where: { name: '其他' },
      create: { name: '其他' },
      update: {},
    }).catch(() => {})

    // 将默认文章同步写入 .md 文件
    try {
      await writeMdFile(defaultSlug, {
        title: 'Hello World!',
        category: '其他',
        summary: 'Welcome to Eric Blog! This is the first article, automatically created when the blog was initialized.',
        status: 'published',
        visibility: 'public',
      }, `# Hello World!

Welcome to Eric Blog. This is the first article, automatically created when the blog was initialized.

## What is this blog about?

This is a personal blog built with Next.js, where I share my thoughts on technology, life, and creative projects. Feel free to explore the articles and leave a comment!

## Quick Start

- **Write articles** - Use the admin panel to create and publish articles
- **Upload images** - The built-in image hosting makes it easy to add images
- **AI assistant** - Use AI to help generate titles, summaries, and tags

Enjoy reading!`)
    } catch (err) {
      console.error('Failed to write default .md file:', err)
    }

    // Generate token
    const token = await createToken({
      userId: admin.id,
      email: admin.email,
      role: admin.role,
    })

    return NextResponse.json({
      user: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
      },
      token,
      message: 'Admin account and default article created successfully',
    }, { status: 201 })
  } catch (error) {
    console.error('Init admin error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  return await initAdmin(body)
}

// GET /api/init - 支持浏览器直接访问初始化
export async function GET() {
  return await initAdmin({})
}
