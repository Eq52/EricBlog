'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import MDEditor from '@uiw/react-md-editor'
import '@uiw/react-md-editor/markdown-editor.css'
import { useTheme } from 'next-themes'
import {
  ArrowLeft,
  Save,
  Sparkles,
  Loader2,
  FileText,
  Tag,
  Type,
  Hash,
  ImageIcon,
  Eye,
  Upload,
  Paperclip,
  Plus,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'
import { useAppStore } from '@/store'

// 图床上传辅助函数
async function uploadImage(file: File, token: string): Promise<string> {
  const formData = new FormData()
  formData.append('image', file)

  const res = await fetch('/api/upload/image', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })
  const data = await res.json()
  if (!res.ok || !data.success) {
    throw new Error(data.error || '上传失败')
  }
  return data.url
}

const CATEGORIES = ['技术', '生活', '教程', '随笔', 'AI', '其他'] // fallback
const VISIBILITIES = [
  { value: 'public', label: '公开' },
  { value: 'auth_only', label: '登录可见' },
  { value: 'private', label: '仅管理员可见' },
]
const STATUSES = [
  { value: 'draft', label: '草稿' },
  { value: 'published', label: '已发布' },
]

export default function ArticleEditor() {
  const { viewParams, user, token, navigate } = useAppStore()
  const isEditing = !!viewParams.id
  const { theme } = useTheme()
  const resolvedTheme = theme === 'dark' ? 'dark' : 'light'

  const [loading, setLoading] = useState(isEditing)
  const [saving, setSaving] = useState(false)
  const [aiLoading, setAiLoading] = useState('')

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [summary, setSummary] = useState('')
  const [category, setCategory] = useState('')
  const [tagsStr, setTagsStr] = useState('')
  const [coverImage, setCoverImage] = useState('')
  const [visibility, setVisibility] = useState('public')
  const [status, setStatus] = useState('draft')
  const [imageUploading, setImageUploading] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [dynamicCategories, setDynamicCategories] = useState<string[]>([])
  const [aiConfigured, setAiConfigured] = useState(true) // 默认允许尝试
  const [titleCandidates, setTitleCandidates] = useState<string[]>([])
  const [showTitlePicker, setShowTitlePicker] = useState(false)
  const [newCategoryInput, setNewCategoryInput] = useState('')
  const [showNewCategory, setShowNewCategory] = useState(false)
  const [creatingCategory, setCreatingCategory] = useState(false)

  // 加载动态分类 + AI 配置状态
  useEffect(() => {
    ;(async () => {
      try {
        const [catRes, aiRes] = await Promise.all([
          fetch('/api/articles/meta'),
          fetch('/api/ai/summarize'),
        ])
        if (catRes.ok) {
          const data = await catRes.json()
          if (data.categories?.length > 0) setDynamicCategories(data.categories)
        }
        if (aiRes.ok) {
          const data = await aiRes.json()
          setAiConfigured(data.configured === true)
        }
      } catch { /* ignore */ }
    })()
  }, [])

  const fetchArticle = useCallback(async () => {
    if (!viewParams.id || !token) return
    setLoading(true)
    try {
      const res = await fetch(`/api/articles/${viewParams.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok || !data.article) {
        toast({ title: '文章未找到', variant: 'destructive' })
        navigate('admin')
        return
      }
      const a = data.article
      setTitle(a.title)
      setContent(a.content)
      setSummary(a.summary || '')
      setCategory(a.category || '')
      try {
        const parsed = JSON.parse(a.tags)
        setTagsStr(Array.isArray(parsed) ? parsed.join(', ') : '')
      } catch {
        setTagsStr('')
      }
      setCoverImage(a.coverImage || '')
      setVisibility(a.visibility || 'public')
      setStatus(a.status || 'draft')
    } catch {
      toast({ title: '加载文章失败', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [viewParams.id, token, navigate])

  useEffect(() => {
    if (isEditing) fetchArticle()
  }, [isEditing, fetchArticle])

  const handleSave = async (publishStatus?: string) => {
    if (!title.trim()) {
      toast({ title: '标题不能为空', variant: 'destructive' })
      return
    }
    if (!content.trim()) {
      toast({ title: '内容不能为空', variant: 'destructive' })
      return
    }
    if (!token) return

    setSaving(true)
    try {
      const tags = tagsStr
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)

      const body: Record<string, unknown> = {
        title: title.trim(),
        content: content.trim(),
        summary: summary.trim() || undefined,
        category: category || undefined,
        tags,
        coverImage: coverImage.trim() || undefined,
        visibility,
        status: publishStatus || status,
      }

      const url = isEditing ? `/api/articles/${viewParams.id}` : '/api/articles'
      const method = isEditing ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      })

      const data = await res.json()
      if (res.ok) {
        toast({
          title: isEditing ? '文章已更新！' : '文章已创建！',
          description: publishStatus === 'published' ? '文章已发布' : '保存成功',
        })
        navigate('admin')
      } else {
        toast({ title: data.error || '保存失败', variant: 'destructive' })
      }
    } catch {
      toast({ title: '网络错误', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  // 处理图片文件上传并插入 Markdown
  const handleImageUpload = useCallback(
    async (file: File) => {
      if (!token) {
        toast({ title: '请先登录', variant: 'destructive' })
        return
      }

      // 验证文件类型
      const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp', 'image/tiff']
      if (!validTypes.includes(file.type)) {
        toast({ title: '不支持的图片格式', variant: 'destructive' })
        return
      }

      // 验证文件大小 (10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: '图片不能超过 10MB', variant: 'destructive' })
        return
      }

      setImageUploading(true)
      try {
        const url = await uploadImage(file, token)
        const markdown = `\n![](${url})\n`
        setContent((prev) => prev + markdown)
        toast({ title: '图片上传成功！' })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : '上传失败'
        toast({ title: message, variant: 'destructive' })
      } finally {
        setImageUploading(false)
      }
    },
    [token, setContent]
  )

  // 文件选择器回调
  const onImageFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleImageUpload(file)
      // 清空 input 以便再次选择同一文件
      e.target.value = ''
    },
    [handleImageUpload]
  )

  // 封面图片上传
  const handleCoverUpload = useCallback(
    async (file: File) => {
      if (!token) {
        toast({ title: '请先登录', variant: 'destructive' })
        return
      }
      setImageUploading(true)
      try {
        const url = await uploadImage(file, token)
        setCoverImage(url)
        toast({ title: '封面上传成功！' })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : '上传失败'
        toast({ title: message, variant: 'destructive' })
      } finally {
        setImageUploading(false)
      }
    },
    [token]
  )

  const onCoverFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleCoverUpload(file)
      e.target.value = ''
    },
    [handleCoverUpload]
  )

  const handleAiAction = async (type: 'summary' | 'title' | 'tags') => {
    if (!token) {
      toast({ title: '请先登录', variant: 'destructive' })
      return
    }
    if (!content.trim()) {
      toast({ title: '请先添加内容', variant: 'destructive' })
      return
    }
    setAiLoading(type)
    try {
      const res = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content, type }),
      })
      const data = await res.json()
      if (data.result) {
        switch (type) {
          case 'summary':
            setSummary(data.result)
            toast({ title: '摘要已生成！' })
            break
          case 'title':
            const titles = data.result.split('\n').map((t: string) => t.trim()).filter(Boolean)
            if (titles.length > 1) {
              // 有多个候选，显示选择弹窗
              setTitleCandidates(titles.slice(0, 5))
              setShowTitlePicker(true)
            } else {
              setTitle(titles[0] || data.result)
            }
            toast({ title: '标题候选已生成！' })
            break
          case 'tags':
            if (Array.isArray(data.result)) {
              setTagsStr(data.result.join(', '))
            } else {
              setTagsStr(data.result)
            }
            toast({ title: '标签已生成！' })
            break
        }
      } else {
        const hint = data.code === 'NOT_CONFIGURED' ? '（请在个人中心完成 AI 服务配置）' : ''
        toast({ title: data.error || `AI 服务出错${hint}`, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'AI 服务出错', variant: 'destructive' })
    } finally {
      setAiLoading('')
    }
  }

  const handleCreateCategory = async () => {
    const name = newCategoryInput.trim()
    if (!name || !token) return
    // 检查重复
    if (dynamicCategories.includes(name)) {
      setCategory(name)
      setShowNewCategory(false)
      setNewCategoryInput('')
      toast({ title: '该分类已存在，已自动选择' })
      return
    }
    setCreatingCategory(true)
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name }),
      })
      if (res.ok) {
        setDynamicCategories((prev) => [...prev, name])
        setCategory(name)
        setShowNewCategory(false)
        setNewCategoryInput('')
        toast({ title: `分类「${name}」已创建` })
      } else {
        const data = await res.json()
        toast({ title: data.error || '创建分类失败', variant: 'destructive' })
      }
    } catch {
      toast({ title: '创建分类失败', variant: 'destructive' })
    } finally {
      setCreatingCategory(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <Skeleton className="mb-4 h-10 w-24" />
        <Skeleton className="mb-6 h-10 w-full" />
        <Skeleton className="mb-4 h-24 w-full" />
        <Skeleton className="mb-4 h-96 w-full" />
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mx-auto max-w-6xl px-4 py-6 sm:px-6"
    >
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('admin')}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">
            {isEditing ? '编辑文章' : '新建文章'}
          </h1>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => handleSave('draft')}
            disabled={saving}
            className="gap-2"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            保存草稿
          </Button>
          <Button
            onClick={() => handleSave('published')}
            disabled={saving}
            className="gap-2 bg-foreground text-background hover:bg-foreground/90"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
            发布
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Title */}
        <div className="space-y-2">
          <Label htmlFor="title" className="flex items-center gap-2 text-sm font-medium">
            <Type className="h-4 w-4 text-muted-foreground" />
            标题 <span className="text-destructive">*</span>
          </Label>
          <Input
            id="title"
            placeholder="输入文章标题..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-lg font-medium"
          />
        </div>

        {/* Content + Sidebar */}
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            {/* Content with Live Preview */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="content" className="flex items-center gap-2 text-sm font-medium">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  内容 <span className="text-destructive">*</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    (支持 Markdown)
                  </span>
                </Label>
                <div className="flex items-center gap-2">
                  {/* Image upload toolbar */}
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,image/bmp,image/tiff"
                    className="hidden"
                    onChange={onImageFileChange}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={imageUploading}
                    className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                    title="上传图片 (支持拖拽和粘贴)"
                  >
                    {imageUploading ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Upload className="h-3 w-3" />
                    )}
                    {imageUploading ? '上传中...' : '插入图片'}
                  </Button>
                </div>
              </div>
              {/* MDEditor with built-in split-pane */}
              <div data-color-mode={resolvedTheme}>
                <MDEditor
                  value={content}
                  onChange={(val) => setContent(val || '')}
                  height={520}
                  preview="live"
                />
              </div>
            </div>

            {/* Summary */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="summary" className="flex items-center gap-2 text-sm font-medium">
                  摘要
                </Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleAiAction('summary')}
                  disabled={aiLoading === 'summary'}
                  className="gap-1.5 h-7 text-xs text-foreground hover:text-foreground"
                >
                  {aiLoading === 'summary' ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                  AI 生成
                </Button>
              </div>
              <Textarea
                id="summary"
                placeholder="文章简介..."
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* AI Helpers */}
            <Card className="border-border bg-muted/30">
              <CardContent className="p-4">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <Sparkles className="h-4 w-4 text-foreground" />
                  AI 助手
                  {!aiConfigured && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                      未配置
                    </span>
                  )}
                </h3>
                {!aiConfigured && (
                  <p className="mb-3 text-xs text-muted-foreground">
                    AI 功能未启用，请前往
                    <button
                      onClick={() => navigate('profile')}
                      className="mx-1 font-medium text-foreground underline underline-offset-2 hover:text-foreground/80"
                    >
                      个人中心
                    </button>
                    完成 AI 服务配置。
                  </p>
                )}
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start gap-2 text-xs"
                    onClick={() => handleAiAction('title')}
                    disabled={aiLoading === 'title'}
                  >
                    {aiLoading === 'title' ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Type className="h-3 w-3" />
                    )}
                    生成标题
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start gap-2 text-xs"
                    onClick={() => handleAiAction('summary')}
                    disabled={aiLoading === 'summary'}
                  >
                    {aiLoading === 'summary' ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <FileText className="h-3 w-3" />
                    )}
                    生成摘要
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start gap-2 text-xs"
                    onClick={() => handleAiAction('tags')}
                    disabled={aiLoading === 'tags'}
                  >
                    {aiLoading === 'tags' ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Tag className="h-3 w-3" />
                    )}
                    生成标签
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Category - 带内联创建 */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">分类</Label>
              {showNewCategory ? (
                <div className="flex gap-2">
                  <Input
                    placeholder="输入新分类名..."
                    value={newCategoryInput}
                    onChange={(e) => setNewCategoryInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleCreateCategory()
                      }
                      if (e.key === 'Escape') {
                        setShowNewCategory(false)
                        setNewCategoryInput('')
                      }
                    }}
                    className="h-9 flex-1 text-sm"
                    autoFocus
                  />
                  <Button
                    size="sm"
                    onClick={handleCreateCategory}
                    disabled={creatingCategory || !newCategoryInput.trim()}
                    className="h-9 gap-1.5 bg-foreground text-background hover:bg-foreground/90"
                  >
                    {creatingCategory ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                    添加
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    onClick={() => { setShowNewCategory(false); setNewCategoryInput('') }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="选择分类" />
                    </SelectTrigger>
                    <SelectContent>
                      {dynamicCategories.length > 0 ? dynamicCategories.map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      )) : CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    onClick={() => setShowNewCategory(true)}
                    title="新建分类"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label htmlFor="tags" className="flex items-center gap-2 text-sm font-medium">
                <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                标签
              </Label>
              <Input
                id="tags"
                placeholder="标签1, 标签2, 标签3"
                value={tagsStr}
                onChange={(e) => setTagsStr(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">用逗号分隔标签</p>
            </div>

            {/* Cover Image */}
            <div className="space-y-2">
              <Label htmlFor="cover" className="flex items-center gap-2 text-sm font-medium">
                <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                封面图片
              </Label>
              <div className="flex gap-2">
                <Input
                  id="cover"
                  placeholder="https://example.com/image.jpg"
                  value={coverImage}
                  onChange={(e) => setCoverImage(e.target.value)}
                  className="flex-1"
                />
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,image/bmp,image/tiff"
                  className="hidden"
                  id="cover-upload-input"
                  onChange={onCoverFileChange}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    document.getElementById('cover-upload-input')?.click()
                  }
                  disabled={imageUploading}
                  className="h-9 w-9 shrink-0"
                  title="上传封面图片"
                >
                  {imageUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Paperclip className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {coverImage && (
                <div className="mt-2 overflow-hidden rounded-lg border border-border">
                  <img
                    src={coverImage}
                    alt="封面预览"
                    className="h-auto max-h-40 w-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                </div>
              )}
            </div>

            {/* Visibility */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">可见性</Label>
              <Select value={visibility} onValueChange={setVisibility}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VISIBILITIES.map((v) => (
                    <SelectItem key={v.value} value={v.value}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">状态</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Title Candidate Picker Dialog */}
      <Dialog open={showTitlePicker} onOpenChange={setShowTitlePicker}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4" />
              选择标题
            </DialogTitle>
            <DialogDescription>
              AI 为你生成了以下标题候选，点击选择一个作为文章标题：
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {titleCandidates.map((t, i) => (
              <button
                key={i}
                onClick={() => {
                  setTitle(t)
                  setShowTitlePicker(false)
                  toast({ title: '标题已应用' })
                }}
                className={`w-full rounded-lg border px-4 py-3 text-left text-sm transition-all hover:border-foreground hover:bg-muted/50 ${
                  t === title ? 'border-foreground bg-muted/30' : 'border-border'
                }`}
              >
                <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                  {i + 1}
                </span>
                {t}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
