import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/admin/settings/landing - 获取着陆页背景设置（无需鉴权，公开接口）
export async function GET() {
  try {
    const setting = await db.siteSetting.findUnique({
      where: { key: 'landing_background' },
    })

    return NextResponse.json({
      backgroundUrl: setting?.value || '',
    })
  } catch (error) {
    console.error('Landing settings GET error:', error)
    return NextResponse.json({ backgroundUrl: '' })
  }
}
