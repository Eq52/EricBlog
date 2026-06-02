/**
 * Markdown 文件工具库
 * 处理带 YAML frontmatter 的 .md 文件的读写
 * 
 * 文件格式:
 * ---
 * title: 文章标题
 * category: 技术
 * tags: ["标签1", "标签2"]
 * summary: 文章摘要
 * coverImage: https://example.com/cover.jpg
 * status: published
 * visibility: public
 * ---
 * 
 * Markdown 正文内容...
 */

import { promises as fs } from 'fs'
import path from 'path'

// MD 文件存储目录（项目根目录下的 content/）
const CONTENT_DIR = path.join(process.cwd(), 'content')

// 确保 content 目录存在
export async function ensureContentDir() {
  try {
    await fs.mkdir(CONTENT_DIR, { recursive: true })
  } catch { /* ignore */ }
}

// Frontmatter 数据结构
export interface MdFrontmatter {
  title: string
  category?: string
  tags?: string[]
  summary?: string
  coverImage?: string
  status?: string
  visibility?: string
  slug?: string
  createdAt?: string
  updatedAt?: string
}

// MD 文件解析结果
export interface MdFile {
  frontmatter: MdFrontmatter
  content: string
  filePath: string
  fileName: string
}

/**
 * 简易 YAML 解析器（仅支持项目中用到的字段类型）
 * 不依赖第三方库，避免增加项目体积
 */
function parseYaml(text: string): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  const lines = text.split('\n')
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // 跳过空行和注释
    if (!line.trim() || line.trim().startsWith('#')) continue
    
    const match = line.match(/^(\w+)\s*:\s*(.*)$/)
    if (match) {
      const key = match[1].trim()
      let value: unknown = match[2].trim()
      
      // 解析 JSON 数组（如 tags: ["tag1", "tag2"]）
      if (typeof value === 'string' && value.startsWith('[')) {
        try {
          value = JSON.parse(value)
        } catch { /* 保持原始字符串 */ }
      }
      
      // 去除引号包裹的字符串值
      if (typeof value === 'string' && value.length >= 2) {
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1)
        }
      }
      
      result[key] = value
    }
  }
  
  return result
}

/**
 * 将 frontmatter 对象序列化为 YAML 格式
 */
function serializeYaml(data: Record<string, unknown>): string {
  const lines: string[] = []
  
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue
    
    if (Array.isArray(value)) {
      lines.push(`${key}: ${JSON.stringify(value)}`)
    } else if (typeof value === 'string') {
      // 包含特殊字符的字符串加引号
      if (value.includes(':') || value.includes('#') || value.includes('"')) {
        lines.push(`${key}: "${value.replace(/"/g, '\\"')}"`)
      } else {
        lines.push(`${key}: ${value}`)
      }
    } else {
      lines.push(`${key}: ${String(value)}`)
    }
  }
  
  return lines.join('\n')
}

/**
 * 从 .md 文件内容中解析 frontmatter 和正文
 */
export function parseMdFile(fileContent: string): { frontmatter: MdFrontmatter; content: string } {
  const trimmed = fileContent.trim()
  
  if (!trimmed.startsWith('---')) {
    return { frontmatter: {}, content: fileContent }
  }
  
  // 找到 frontmatter 结束标记（第二个 ---）
  const endIndex = trimmed.indexOf('\n---', 3)
  if (endIndex === -1) {
    return { frontmatter: {}, content: fileContent }
  }
  
  const yamlStr = trimmed.slice(3, endIndex).trim()
  const body = trimmed.slice(endIndex + 4).trim()
  
  const rawFrontmatter = parseYaml(yamlStr)
  
  return {
    frontmatter: {
      title: String(rawFrontmatter.title || ''),
      category: rawFrontmatter.category ? String(rawFrontmatter.category) : undefined,
      tags: Array.isArray(rawFrontmatter.tags) ? rawFrontmatter.tags.map(String) : undefined,
      summary: rawFrontmatter.summary ? String(rawFrontmatter.summary) : undefined,
      coverImage: rawFrontmatter.coverImage ? String(rawFrontmatter.coverImage) : undefined,
      status: rawFrontmatter.status ? String(rawFrontmatter.status) : undefined,
      visibility: rawFrontmatter.visibility ? String(rawFrontmatter.visibility) : undefined,
      slug: rawFrontmatter.slug ? String(rawFrontmatter.slug) : undefined,
      createdAt: rawFrontmatter.createdAt ? String(rawFrontmatter.createdAt) : undefined,
      updatedAt: rawFrontmatter.updatedAt ? String(rawFrontmatter.updatedAt) : undefined,
    },
    content: body,
  }
}

/**
 * 将 frontmatter 和正文内容序列化为完整的 .md 文件内容
 */
export function serializeMdFile(frontmatter: MdFrontmatter, content: string): string {
  // 只保存非空的有效字段
  const cleanData: Record<string, unknown> = {}
  if (frontmatter.title) cleanData.title = frontmatter.title
  if (frontmatter.category) cleanData.category = frontmatter.category
  if (frontmatter.tags && frontmatter.tags.length > 0) cleanData.tags = frontmatter.tags
  if (frontmatter.summary) cleanData.summary = frontmatter.summary
  if (frontmatter.coverImage) cleanData.coverImage = frontmatter.coverImage
  if (frontmatter.status) cleanData.status = frontmatter.status
  if (frontmatter.visibility) cleanData.visibility = frontmatter.visibility
  if (frontmatter.createdAt) cleanData.createdAt = frontmatter.createdAt
  if (frontmatter.updatedAt) cleanData.updatedAt = frontmatter.updatedAt

  return `---\n${serializeYaml(cleanData)}\n---\n\n${content}\n`
}

/**
 * 根据 slug 生成安全的文件名
 */
export function slugToFileName(slug: string): string {
  return `${slug}.md`
}

/**
 * 从文件名中提取 slug
 */
export function fileNameToSlug(fileName: string): string {
  return fileName.replace(/\.md$/, '')
}

/**
 * 读取单个 .md 文件
 */
export async function readMdFile(slug: string): Promise<MdFile | null> {
  await ensureContentDir()
  const filePath = path.join(CONTENT_DIR, slugToFileName(slug))
  
  try {
    const fileContent = await fs.readFile(filePath, 'utf-8')
    const { frontmatter, content } = parseMdFile(fileContent)
    return {
      frontmatter,
      content,
      filePath,
      fileName: slugToFileName(slug),
    }
  } catch (err) {
    // 文件不存在
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw err
  }
}

/**
 * 写入 .md 文件（自动创建目录）
 */
export async function writeMdFile(slug: string, frontmatter: MdFrontmatter, content: string): Promise<string> {
  await ensureContentDir()
  const filePath = path.join(CONTENT_DIR, slugToFileName(slug))
  const fileContent = serializeMdFile(frontmatter, content)
  await fs.writeFile(filePath, fileContent, 'utf-8')
  return filePath
}

/**
 * 删除 .md 文件
 */
export async function deleteMdFile(slug: string): Promise<boolean> {
  await ensureContentDir()
  const filePath = path.join(CONTENT_DIR, slugToFileName(slug))
  
  try {
    await fs.unlink(filePath)
    return true
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw err
  }
}

/**
 * 列出 content 目录下所有 .md 文件
 */
export async function listMdFiles(): Promise<MdFile[]> {
  await ensureContentDir()
  
  try {
    const files = await fs.readdir(CONTENT_DIR)
    const mdFiles: MdFile[] = []
    
    for (const fileName of files) {
      if (!fileName.endsWith('.md')) continue
      
      const filePath = path.join(CONTENT_DIR, fileName)
      try {
        const fileContent = await fs.readFile(filePath, 'utf-8')
        const { frontmatter, content } = parseMdFile(fileContent)
        mdFiles.push({
          frontmatter,
          content,
          filePath,
          fileName,
        })
      } catch { /* skip unreadable files */ }
    }
    
    return mdFiles
  } catch {
    return []
  }
}

/**
 * 从 MD 文件内容读取文章正文（供文章查看使用）
 * 优先从 .md 文件读取，如果不存在则返回 fallback
 */
export async function readArticleContent(slug: string, fallback?: string): Promise<string> {
  const mdFile = await readMdFile(slug)
  if (mdFile) return mdFile.content
  return fallback || ''
}

/**
 * 检查 slug 对应的 .md 文件是否存在
 */
export async function mdFileExists(slug: string): Promise<boolean> {
  const mdFile = await readMdFile(slug)
  return mdFile !== null
}
