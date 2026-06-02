import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, getTokenFromHeader } from '@/lib/auth'
import { promises as fs } from 'fs'
import path from 'path'
import crypto from 'crypto'

/**
 * 自建图床 — 图片上传接口
 *
 * POST /api/upload/image
 * Content-Type: multipart/form-data
 * Field: image (File)
 * Authorization: Bearer <token>（管理员）
 *
 * Response: { success: true, url: "/uploads/<filename>" }
 */

// 允许的文件类型
const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/tiff',
  'image/svg+xml',
  'image/avif',
])

// 最大文件大小：10MB
const MAX_SIZE = 10 * 1024 * 1024

// 上传存储目录
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads')

// 确保 uploads 目录存在
async function ensureUploadDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true })
}

// 生成唯一文件名：时间戳 + 8位随机hex + 原始扩展名
function generateFileName(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase() || '.png'
  const timestamp = Date.now().toString(36)
  const random = crypto.randomBytes(4).toString('hex')
  return `${timestamp}-${random}${ext}`
}

// 清理文件名，防止路径穿越
function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

// 根据文件类型确定安全的扩展名（覆盖用户上传的伪装扩展名）
function getSafeExtension(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/bmp': '.bmp',
    'image/tiff': '.tiff',
    'image/svg+xml': '.svg',
    'image/avif': '.avif',
  }
  return map[mimeType] || '.png'
}

export async function POST(request: NextRequest) {
  try {
    // 1. 验证身份 — 管理员才能上传
    const token = getTokenFromHeader(request)
    if (!token) {
      return NextResponse.json({ success: false, error: '未登录，请先登录' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ success: false, error: '仅管理员可上传图片' }, { status: 403 })
    }

    // 2. 解析 FormData
    const formData = await request.formData()
    const file = formData.get('image')
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ success: false, error: '未接收到图片文件' }, { status: 400 })
    }

    // 3. 验证文件类型
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { success: false, error: `不支持的文件类型: ${file.type}，允许: JPEG/PNG/WebP/GIF/BMP/TIFF/SVG/AVIF` },
        { status: 400 }
      )
    }

    // 4. 验证文件大小
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { success: false, error: `文件过大（${(file.size / 1024 / 1024).toFixed(1)}MB），最大允许 10MB` },
        { status: 400 }
      )
    }

    // 5. 生成安全文件名并保存
    await ensureUploadDir()
    const ext = getSafeExtension(file.type)
    const fileName = generateFileName(`image${ext}`)
    const filePath = path.join(UPLOAD_DIR, sanitizeFileName(fileName))

    const buffer = Buffer.from(await file.arrayBuffer())
    await fs.writeFile(filePath, buffer)

    // 6. 返回可访问的 URL
    const url = `/uploads/${sanitizeFileName(fileName)}`

    return NextResponse.json({
      success: true,
      url,
      fileName: sanitizeFileName(fileName),
      size: file.size,
      type: file.type,
    })
  } catch (error) {
    console.error('Image upload error:', error)
    return NextResponse.json({ success: false, error: '上传失败，服务器内部错误' }, { status: 500 })
  }
}

/**
 * GET /api/upload/image
 * 返回已上传图片列表（仅管理员）
 */
export async function GET(request: NextRequest) {
  try {
    const token = getTokenFromHeader(request)
    if (!token) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ success: false, error: '仅管理员可查看' }, { status: 403 })
    }

    await ensureUploadDir()
    const files = await fs.readdir(UPLOAD_DIR)

    const images = files
      .filter((f) => /\.(jpg|jpeg|png|webp|gif|bmp|tiff|svg|avif)$/i.test(f))
      .map((f) => {
        const url = `/uploads/${f}`
        return { fileName: f, url }
      })

    return NextResponse.json({ success: true, images, total: images.length })
  } catch (error) {
    console.error('List images error:', error)
    return NextResponse.json({ success: false, error: '获取图片列表失败' }, { status: 500 })
  }
}

/**
 * DELETE /api/upload/image?fileName=xxx.jpg
 * 删除指定图片（仅管理员）
 */
export async function DELETE(request: NextRequest) {
  try {
    const token = getTokenFromHeader(request)
    if (!token) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ success: false, error: '仅管理员可删除' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const fileName = searchParams.get('fileName')

    if (!fileName) {
      return NextResponse.json({ success: false, error: '缺少 fileName 参数' }, { status: 400 })
    }

    // 安全检查：防止路径穿越
    const sanitizedName = sanitizeFileName(fileName)
    if (sanitizedName !== fileName || sanitizedName.includes('..') || sanitizedName.includes('/')) {
      return NextResponse.json({ success: false, error: '非法的文件名' }, { status: 400 })
    }

    const filePath = path.join(UPLOAD_DIR, sanitizedName)
    try {
      await fs.unlink(filePath)
      return NextResponse.json({ success: true, message: '图片已删除' })
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return NextResponse.json({ success: false, error: '文件不存在' }, { status: 404 })
      }
      throw err
    }
  } catch (error) {
    console.error('Delete image error:', error)
    return NextResponse.json({ success: false, error: '删除失败' }, { status: 500 })
  }
}
