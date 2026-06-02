import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyToken, getTokenFromHeader } from '@/lib/auth'

// 支持的 AI 服务商配置
interface AIProvider {
  provider: string       // 'spark' | 'openai' | 'custom'
  apiKey: string
  apiBase: string        // API endpoint base URL
  model: string
}

async function getAIConfig(): Promise<AIProvider | null> {
  const setting = await db.siteSetting.findUnique({
    where: { key: 'ai_config' },
  })
  if (!setting?.value) return null
  try {
    return JSON.parse(setting.value) as AIProvider
  } catch {
    return null
  }
}

// 从 API 错误响应中提取可读的错误信息
function extractErrorMessage(responseText: string, statusCode: number): string {
  try {
    const data = JSON.parse(responseText)
    const msg = data?.error?.message || data?.message || data?.error?.msg || ''
    if (msg) return `AI 服务请求失败 (${statusCode}): ${msg}`
  } catch { /* ignore */ }
  return `AI 服务请求失败 (${statusCode})`
}

// 根据不同服务商构建请求
async function callAI(config: AIProvider, systemPrompt: string, userPrompt: string): Promise<string> {
  const { apiBase, apiKey, model } = config

  // 讯飞星火 (Spark) 兼容格式
  if (config.provider === 'spark' || apiBase.includes('xf-yun.com')) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)
    try {
      const response = await fetch(apiBase, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model || 'lite',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
      })
      clearTimeout(timeout)
      if (!response.ok) {
        const text = await response.text()
        console.error('Spark API error:', response.status, text)
        const detail = extractErrorMessage(text, response.status)
        throw new Error(detail)
      }
      const data = await response.json()
      return data.choices?.[0]?.message?.content || ''
    } catch (err) {
      clearTimeout(timeout)
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new Error('AI 服务请求超时 (30秒)，请检查网络或更换服务')
      }
      throw err
    }
  }

  // OpenAI 兼容格式 (包括 deepseek、moonshot、通义千问、自定义模型等)
  // 如果 apiBase 已经包含 /chat/completions，直接使用
  let endpoint: string
  const normalizedBase = apiBase.replace(/\/+$/, '')
  if (normalizedBase.endsWith('/chat/completions')) {
    endpoint = normalizedBase
  } else if (normalizedBase.endsWith('/v1')) {
    endpoint = `${normalizedBase}/chat/completions`
  } else {
    // 自动推断：如果路径中没有 /v1，自动加上 /v1 前缀
    endpoint = normalizedBase.includes('/v1/')
      ? `${normalizedBase}/chat/completions`
      : `${normalizedBase}/v1/chat/completions`
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    })
    clearTimeout(timeout)
    if (!response.ok) {
      const text = await response.text()
      console.error('AI API error:', response.status, text)
      const detail = extractErrorMessage(text, response.status)
      throw new Error(detail)
    }
    const data = await response.json()
    return data.choices?.[0]?.message?.content || ''
  } catch (err) {
    clearTimeout(timeout)
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('AI 服务请求超时 (30秒)，请检查网络或更换服务')
    }
    throw err
  }
}

// 验证管理员权限
async function verifyAdmin(request: NextRequest): Promise<boolean> {
  const token = getTokenFromHeader(request)
  if (!token) return false
  const payload = await verifyToken(token)
  return !!(payload && payload.role === 'admin')
}

export async function POST(request: NextRequest) {
  try {
    // 验证身份（仅登录用户可用，不限制必须管理员）
    const token = getTokenFromHeader(request)
    if (!token) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }
    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: '身份验证失败' }, { status: 401 })
    }

    // 获取 AI 配置
    const config = await getAIConfig()
    if (!config || !config.apiKey) {
      return NextResponse.json(
        { error: 'AI 功能未配置，请在个人中心完成 AI 服务配置', code: 'NOT_CONFIGURED' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { content, type } = body

    if (!content || !type) {
      return NextResponse.json({ error: 'Content and type are required' }, { status: 400 })
    }

    if (!['summary', 'title', 'tags'].includes(type)) {
      return NextResponse.json(
        { error: 'Type must be "summary", "title", or "tags"' },
        { status: 400 }
      )
    }

    let systemPrompt = '你是一个专业的文章助手。'
    let userPrompt = ''

    switch (type) {
      case 'summary':
        systemPrompt =
          '你是一个专业的文章助手。请根据提供的文章内容，生成一段简洁的摘要，字数在100-200字之间。只输出摘要内容，不要包含其他说明。'
        userPrompt = `请为以下文章生成摘要：\n\n${content}`
        break
      case 'title':
        systemPrompt =
          '你是一个专业的文章助手。请根据提供的文章内容，生成3个吸引人的标题候选。每行一个标题，不要编号，不要包含其他说明。'
        userPrompt = `请为以下文章生成3个标题候选：\n\n${content}`
        break
      case 'tags':
        systemPrompt =
          '你是一个专业的文章助手。请根据提供的文章内容，生成5个相关的标签。必须以纯JSON数组格式返回，例如 ["标签1","标签2","标签3","标签4","标签5"]。不要包含其他任何文字说明。'
        userPrompt = `请为以下文章生成5个标签：\n\n${content}`
        break
    }

    // 调用 AI 服务
    const result = await callAI(config, systemPrompt, userPrompt)

    // For tags, try to parse as JSON array
    if (type === 'tags') {
      try {
        const parsed = JSON.parse(result)
        if (Array.isArray(parsed)) {
          return NextResponse.json({ result: parsed })
        }
      } catch {
        // If parsing fails, extract tags from the response
        const tags = result
          .match(/["""]([^"""]+)["""]/g)
          ?.map((t: string) => t.replace(/["""]/g, ''))
        if (tags && tags.length > 0) {
          return NextResponse.json({ result: tags.slice(0, 5) })
        }
      }
    }

    return NextResponse.json({ result })
  } catch (error) {
    console.error('AI summarize error:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// GET /api/ai/summarize — 返回当前 AI 配置状态（是否已配置）
export async function GET() {
  try {
    const config = await getAIConfig()
    return NextResponse.json({
      configured: !!(config && config.apiKey),
      provider: config?.provider || null,
    })
  } catch {
    return NextResponse.json({ configured: false, provider: null })
  }
}
