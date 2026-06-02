import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyToken, verifyPassword, hashPassword, createToken } from '@/lib/auth'
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

// 验证管理员身份的通用函数
async function verifyAdmin(authHeader: string | null) {
  if (!authHeader?.startsWith('Bearer ')) return null
  const payload = await verifyToken(authHeader.slice(7))
  if (!payload || payload.role !== 'admin') return null
  return payload
}

// GET /api/admin/settings - 获取站点设置（域名白名单等）
export async function GET(request: NextRequest) {
  try {
    const payload = await verifyAdmin(request.headers.get('authorization'))
    if (!payload) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 })
    }

    // 获取允许的域名列表
    const domainSetting = await db.siteSetting.findUnique({
      where: { key: 'allowed_domains' },
    })
    const allowedDomains = domainSetting?.value
      ? JSON.parse(domainSetting.value) as string[]
      : []

    // 获取着陆页背景
    const bgSetting = await db.siteSetting.findUnique({
      where: { key: 'landing_background' },
    })

    // 获取 AI 配置
    const aiSetting = await db.siteSetting.findUnique({
      where: { key: 'ai_config' },
    })
    let aiConfig = null
    if (aiSetting?.value) {
      try {
        aiConfig = JSON.parse(aiSetting.value)
        // 脱敏：隐藏 API Key 中间部分
        if (aiConfig.apiKey) {
          aiConfig.apiKeyMasked = aiConfig.apiKey.length > 8
            ? aiConfig.apiKey.slice(0, 4) + '****' + aiConfig.apiKey.slice(-4)
            : '****'
        }
        delete aiConfig.apiKey
      } catch { /* ignore */ }
    }

    return NextResponse.json({
      allowedDomains,
      landingBackground: bgSetting?.value || '',
      aiConfig,
    })
  } catch (error) {
    console.error('Get settings error:', error)
    return NextResponse.json({ error: '获取设置失败' }, { status: 500 })
  }
}

// PUT /api/admin/settings - 更新站点设置
export async function PUT(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const payload = await verifyAdmin(authHeader)
    if (!payload) {
      return NextResponse.json({ error: '权限不足，仅管理员可操作' }, { status: 403 })
    }

    const body = await request.json()
    const { email, currentPassword, newPassword, allowedDomains, landingBackground, aiConfig } = body

    const results: Record<string, unknown> = {}

    // === 1. 更新允许的域名 ===
    if (allowedDomains !== undefined) {
      if (!Array.isArray(allowedDomains)) {
        return NextResponse.json({ error: 'allowedDomains 必须是数组' }, { status: 400 })
      }

      // 验证每个域名格式
      for (const domain of allowedDomains) {
        const trimmed = String(domain).trim()
        if (!trimmed) continue
        const d = trimmed.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
        // 简单验证：必须包含至少一个点
        if (!d.includes('.') || d.startsWith('.') || d.endsWith('.')) {
          return NextResponse.json(
            { error: `域名格式不正确: ${trimmed}` },
            { status: 400 }
          )
        }
      }

      // 过滤空值并保存
      const cleanDomains = (allowedDomains as string[])
        .map((d) => d.trim())
        .filter(Boolean)

      await db.siteSetting.upsert({
        where: { key: 'allowed_domains' },
        update: { value: JSON.stringify(cleanDomains) },
        create: { key: 'allowed_domains', value: JSON.stringify(cleanDomains) },
      })

      results.allowedDomains = cleanDomains
    }

    // === 1.5. 更新着陆页背景 ===
    if (landingBackground !== undefined) {
      // 如果更换了背景，删除旧的本地文件
      const oldBg = await db.siteSetting.findUnique({ where: { key: 'landing_background' } })
      if (oldBg?.value && oldBg.value !== landingBackground) {
        await deleteLocalFile(oldBg.value)
      }

      const bgValue = String(landingBackground).trim()
      if (bgValue) {
        await db.siteSetting.upsert({
          where: { key: 'landing_background' },
          update: { value: bgValue },
          create: { key: 'landing_background', value: bgValue },
        })
        results.landingBackground = bgValue
      } else {
        // Clear the setting
        await db.siteSetting.deleteMany({ where: { key: 'landing_background' } }).catch(() => {})
        results.landingBackground = ''
      }
    }

    // === 1.6. 更新 AI 配置 ===
    if (aiConfig !== undefined) {
      if (aiConfig === null) {
        // 清空 AI 配置
        await db.siteSetting.deleteMany({ where: { key: 'ai_config' } }).catch(() => {})
        results.aiConfig = null
      } else {
        // 验证 AI 配置
        const { provider, apiKey, apiBase, model } = aiConfig as Record<string, string>
        if (!provider || !apiKey || !apiBase) {
          return NextResponse.json(
            { error: 'AI 配置需要填写服务商、API Key 和接口地址' },
            { status: 400 }
          )
        }
        // 不限制服务商名称，支持任意 OpenAI 兼容接口的自定义配置
        if (!provider || typeof provider !== 'string' || provider.trim().length === 0) {
          return NextResponse.json(
            { error: 'AI 配置需要填写服务商名称' },
            { status: 400 }
          )
        }
        const cleanConfig = JSON.stringify({
          provider,
          apiKey: String(apiKey).trim(),
          apiBase: String(apiBase).trim().replace(/\/$/, ''),
          model: model ? String(model).trim() : '',
        })
        await db.siteSetting.upsert({
          where: { key: 'ai_config' },
          update: { value: cleanConfig },
          create: { key: 'ai_config', value: cleanConfig },
        })
        results.aiConfig = { provider, apiBase, model: model || '' }
      }
    }

    // === 2. 修改邮箱和密码 ===
    if (email || newPassword) {
      const admin = await db.user.findUnique({ where: { id: payload.userId } })
      if (!admin) {
        return NextResponse.json({ error: '用户不存在' }, { status: 404 })
      }

      let updatedEmail = admin.email
      let updatedPassword = admin.password
      let newToken = authHeader!.slice(7)

      if (email && email.trim() !== admin.email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email.trim())) {
          return NextResponse.json({ error: '邮箱格式不正确' }, { status: 400 })
        }

        const existing = await db.user.findUnique({ where: { email: email.trim().toLowerCase() } })
        if (existing && existing.id !== admin.id) {
          return NextResponse.json({ error: '该邮箱已被使用' }, { status: 400 })
        }

        updatedEmail = email.trim().toLowerCase()
      }

      if (newPassword) {
        if (!currentPassword) {
          return NextResponse.json({ error: '修改密码需要输入当前密码' }, { status: 400 })
        }

        const isValid = await verifyPassword(currentPassword, admin.password)
        if (!isValid) {
          return NextResponse.json({ error: '当前密码不正确' }, { status: 400 })
        }

        if (newPassword.length < 6) {
          return NextResponse.json({ error: '新密码至少需要6个字符' }, { status: 400 })
        }

        updatedPassword = await hashPassword(newPassword)
      }

      const updatedAdmin = await db.user.update({
        where: { id: admin.id },
        data: {
          email: updatedEmail,
          password: updatedPassword,
        },
      })

      if (updatedEmail !== admin.email) {
        newToken = await createToken({
          userId: updatedAdmin.id,
          email: updatedAdmin.email,
          role: updatedAdmin.role,
        })
      }

      results.user = {
        id: updatedAdmin.id,
        email: updatedAdmin.email,
        name: updatedAdmin.name,
        role: updatedAdmin.role,
        avatar: updatedAdmin.avatar,
        bio: updatedAdmin.bio,
      }
      results.token = newToken
    }

    return NextResponse.json({
      ...results,
      message: '设置已更新',
    })
  } catch (error) {
    console.error('Admin settings error:', error)
    return NextResponse.json({ error: '服务器错误' }, { status: 500 })
  }
}
