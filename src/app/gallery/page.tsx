'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ZoomIn, ChevronLeft, ChevronRight, Upload, Plus, Trash2, Loader2, ImageIcon, Link2, FileUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Navbar from '@/components/blog/Navbar'
import Footer from '@/components/blog/Footer'
import { useAppStore } from '@/store'
import { toast } from '@/hooks/use-toast'

interface GalleryImage {
  id: string
  url: string
  title: string
  tag: string
  createdAt: string
}

export default function GalleryPage() {
  const { user, token } = useAppStore()
  const isAdmin = user?.role === 'admin'

  const [images, setImages] = useState<GalleryImage[]>([])
  const [tags, setTags] = useState<string[]>(['全部'])
  const [loading, setLoading] = useState(true)
  const [selectedTag, setSelectedTag] = useState('全部')
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set())
  const [uploading, setUploading] = useState(false)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadTag, setUploadTag] = useState('')
  const [showUploadForm, setShowUploadForm] = useState(false)
  const [uploadMode, setUploadMode] = useState<'file' | 'url'>('file')
  const [externalUrl, setExternalUrl] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const filteredImages = selectedTag === '全部'
    ? images
    : images.filter((img) => img.tag === selectedTag)

  // 从数据库加载画廊图片
  const loadGallery = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedTag && selectedTag !== '全部') params.set('tag', selectedTag)

      const res = await fetch(`/api/gallery?${params.toString()}`)
      const data = await res.json()
      setImages(data.images || [])
      setTags(data.tags || ['全部'])
    } catch {
      setImages([])
      setTags(['全部'])
    } finally {
      setLoading(false)
    }
  }, [selectedTag])

  useEffect(() => {
    loadGallery()
  }, [loadGallery])

  const [failedImages, setFailedImages] = useState<Set<string>>(new Set())

  const handleImageLoad = useCallback((id: string) => {
    setLoadedImages((prev) => new Set(prev).add(id))
    setFailedImages((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

  const handleImageError = useCallback((id: string) => {
    setLoadedImages((prev) => new Set(prev).add(id)) // 标记为已处理
    setFailedImages((prev) => new Set(prev).add(id))
  }, [])

  const openLightbox = (index: number) => setLightboxIndex(index)
  const closeLightbox = () => setLightboxIndex(null)

  const goPrev = () => {
    if (lightboxIndex !== null) {
      setLightboxIndex(lightboxIndex === 0 ? filteredImages.length - 1 : lightboxIndex - 1)
    }
  }

  const goNext = () => {
    if (lightboxIndex !== null) {
      setLightboxIndex(lightboxIndex === filteredImages.length - 1 ? 0 : lightboxIndex + 1)
    }
  }

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') closeLightbox()
    if (e.key === 'ArrowLeft') goPrev()
    if (e.key === 'ArrowRight') goNext()
  }, [lightboxIndex, filteredImages.length])

  // 通过外部URL直接添加图片到画廊
  const handleAddByUrl = async () => {
    if (!token || !isAdmin) {
      toast({ title: '仅管理员可添加图片', variant: 'destructive' })
      return
    }

    const url = externalUrl.trim()
    if (!url) {
      toast({ title: '请输入图片链接', variant: 'destructive' })
      return
    }

    // 简单验证URL格式
    try {
      new URL(url)
    } catch {
      toast({ title: '请输入有效的URL地址', variant: 'destructive' })
      return
    }

    setUploading(true)
    try {
      // 验证URL是否可访问（可选，先跳过以支持私有链接）
      const saveRes = await fetch('/api/gallery', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          url,
          title: uploadTitle.trim() || '未命名图片',
          tag: uploadTag.trim(),
        }),
      })
      const saveData = await saveRes.json()

      if (!saveRes.ok) {
        throw new Error(saveData.error || '添加失败')
      }

      // 刷新画廊
      setShowUploadForm(false)
      setUploadTitle('')
      setUploadTag('')
      setExternalUrl('')
      setUploadMode('file')
      toast({ title: '图片添加成功！' })
      loadGallery()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '添加失败'
      toast({ title: message, variant: 'destructive' })
    } finally {
      setUploading(false)
    }
  }

  // 上传图片到图床，然后保存到画廊
  const handleUpload = async () => {
    if (!token || !isAdmin) {
      toast({ title: '仅管理员可上传图片', variant: 'destructive' })
      return
    }

    const file = fileInputRef.current?.files?.[0]
    if (!file) {
      toast({ title: '请选择图片文件', variant: 'destructive' })
      return
    }

    setUploading(true)
    try {
      // 1. 上传到图床
      const formData = new FormData()
      formData.append('image', file)

      const uploadRes = await fetch('/api/upload/image', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      const uploadData = await uploadRes.json()

      if (!uploadRes.ok || !uploadData.success) {
        throw new Error(uploadData.error || '上传失败')
      }

      // 2. 保存到画廊数据库
      const saveRes = await fetch('/api/gallery', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          url: uploadData.url,
          title: uploadTitle.trim() || file.name.replace(/\.[^/.]+$/, ''),
          tag: uploadTag.trim(),
        }),
      })
      const saveData = await saveRes.json()

      if (!saveRes.ok) {
        throw new Error(saveData.error || '保存失败')
      }

      // 刷新画廊
      setShowUploadForm(false)
      setUploadTitle('')
      setUploadTag('')
      setExternalUrl('')
      setUploadMode('file')
      if (fileInputRef.current) fileInputRef.current.value = ''
      toast({ title: '图片上传成功！' })
      loadGallery()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '上传失败'
      toast({ title: message, variant: 'destructive' })
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!token || !isAdmin) return

    try {
      const res = await fetch(`/api/gallery?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '删除失败')
      }
      setDeleteConfirm(null)
      toast({ title: '图片已删除' })
      loadGallery()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '删除失败'
      toast({ title: message, variant: 'destructive' })
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="h-16" />
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-between"
          >
            <div className="text-center sm:text-left">
              <h1 className="mb-3 flex items-center justify-center gap-2 text-3xl font-bold tracking-tight sm:justify-start sm:text-4xl">
                <ImageIcon className="h-8 w-8" />
                画廊
              </h1>
              <p className="mx-auto max-w-xl text-muted-foreground">
                用镜头记录生活中的美好瞬间
              </p>
            </div>
            {isAdmin && (
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={() => { setUploadMode('file'); setShowUploadForm(true) }}
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-2 bg-foreground text-background hover:bg-foreground/90"
                >
                  <Plus className="h-4 w-4" />
                  上传图片
                </Button>
                <Button
                  onClick={() => { setUploadMode('url'); setShowUploadForm(true) }}
                  variant="outline"
                  className="gap-2"
                >
                  <Link2 className="h-4 w-4" />
                  外部链接
                </Button>
              </div>
            )}
          </motion.div>

          {/* Upload Form */}
          <AnimatePresence>
            {showUploadForm && isAdmin && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-8 overflow-hidden"
              >
                <div className="rounded-xl border border-border bg-muted/30 p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-sm font-semibold">{uploadMode === 'file' ? '上传新图片' : '添加外部图片'}</h3>
                    <div className="flex gap-1 rounded-lg bg-muted p-0.5">
                      <button
                        onClick={() => setUploadMode('file')}
                        className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-all ${
                          uploadMode === 'file'
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <FileUp className="h-3.5 w-3.5" />
                        文件上传
                      </button>
                      <button
                        onClick={() => setUploadMode('url')}
                        className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-all ${
                          uploadMode === 'url'
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <Link2 className="h-3.5 w-3.5" />
                        外部链接
                      </button>
                    </div>
                  </div>

                  {uploadMode === 'file' ? (
                    <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto_auto]">
                      <div className="space-y-1.5">
                        <Label className="text-xs">图片标题</Label>
                        <Input
                          placeholder="给图片起个名字..."
                          value={uploadTitle}
                          onChange={(e) => setUploadTitle(e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">标签</Label>
                        <Input
                          placeholder="输入标签（可选）..."
                          value={uploadTag}
                          onChange={(e) => setUploadTag(e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <div className="flex items-end gap-2">
                        <Button
                          onClick={handleUpload}
                          disabled={uploading}
                          className="gap-2 bg-foreground text-background hover:bg-foreground/90"
                          size="sm"
                        >
                          {uploading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4" />
                          )}
                          {uploading ? '上传中...' : '确认上传'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setShowUploadForm(false)
                            setUploadTitle('')
                            setUploadTag('')
                            if (fileInputRef.current) fileInputRef.current.value = ''
                          }}
                        >
                          取消
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs">图片链接</Label>
                        <Input
                          placeholder="https://example.com/image.jpg"
                          value={externalUrl}
                          onChange={(e) => setExternalUrl(e.target.value)}
                          className="h-9"
                        />
                        <p className="text-xs text-muted-foreground">
                          支持任意可公开访问的图片URL（jpg、png、webp、gif等）
                        </p>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto_auto]">
                        <div className="space-y-1.5">
                          <Label className="text-xs">图片标题</Label>
                          <Input
                            placeholder="给图片起个名字..."
                            value={uploadTitle}
                            onChange={(e) => setUploadTitle(e.target.value)}
                            className="h-9"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">标签</Label>
                          <Input
                            placeholder="输入标签（可选）..."
                            value={uploadTag}
                            onChange={(e) => setUploadTag(e.target.value)}
                            className="h-9"
                          />
                        </div>
                        <div className="flex items-end gap-2">
                          <Button
                            onClick={handleAddByUrl}
                            disabled={uploading}
                            className="gap-2 bg-foreground text-background hover:bg-foreground/90"
                            size="sm"
                          >
                            {uploading ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Plus className="h-4 w-4" />
                            )}
                            {uploading ? '添加中...' : '确认添加'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setShowUploadForm(false)
                              setUploadTitle('')
                              setUploadTag('')
                              setExternalUrl('')
                            }}
                          >
                            取消
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Tag Filter - 动态标签 */}
          {tags.length > 1 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="mb-10 flex flex-wrap items-center justify-center gap-2"
            >
              {tags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(tag)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                    selectedTag === tag
                      ? 'bg-foreground text-background shadow-md'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {tag || '未分类'}
                </button>
              ))}
            </motion.div>
          )}

          {/* Masonry Grid */}
          {loading ? (
            <div className="columns-2 gap-4 sm:columns-3 lg:columns-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="mb-4 h-48 skeleton-shimmer rounded-lg bg-muted" />
              ))}
            </div>
          ) : filteredImages.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="py-20 text-center"
            >
              <ImageIcon className="mx-auto mb-4 h-16 w-16 text-muted-foreground/30" />
              <p className="mb-2 text-lg font-medium text-muted-foreground">
                {isAdmin ? '还没有图片' : '暂无图片'}
              </p>
              <p className="text-sm text-muted-foreground">
                {isAdmin ? '点击上方「上传图片」按钮添加第一张图片' : '画廊暂时还没有内容'}
              </p>
            </motion.div>
          ) : (
            <>
              <motion.div className="columns-2 gap-4 sm:columns-3 lg:columns-4" layout>
                <AnimatePresence mode="popLayout">
                  {filteredImages.map((image, idx) => (
                    <motion.div
                      key={image.id}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.4, delay: idx * 0.03 }}
                      className="group relative mb-4 break-inside-avoid"
                    >
                      <div
                        className="relative cursor-pointer overflow-hidden rounded-lg min-h-[200px]"
                        onClick={() => openLightbox(idx)}
                      >
                        {/* Skeleton */}
                        {!loadedImages.has(image.id) && (
                          <div
                            className="h-48 animate-pulse bg-muted"
                          />
                        )}
                        {/* Image */}
                        {failedImages.has(image.id) ? (
                          <div
                            className="flex h-48 w-full flex-col items-center justify-center bg-muted text-muted-foreground"
                          >
                            <ImageIcon className="mb-1 h-8 w-8 opacity-30" />
                            <span className="text-xs opacity-50">加载失败</span>
                          </div>
                        ) : (
                          <img
                            src={image.url}
                            alt={image.title}
                            loading="lazy"
                            crossOrigin="anonymous"
                            referrerPolicy="no-referrer"
                            onLoad={() => handleImageLoad(image.id)}
                            onError={() => handleImageError(image.id)}
                            className={`w-full transition-all duration-500 group-hover:scale-105 ${
                              loadedImages.has(image.id) ? 'opacity-100' : 'absolute inset-0 opacity-0'
                            }`}
                          />
                        )}
                        {/* Hover Overlay */}
                        <div className="absolute inset-0 bg-black/0 transition-all duration-300 group-hover:bg-black/30">
                          <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                            <ZoomIn className="mb-2 h-8 w-8 text-white" />
                            <span className="text-sm font-medium text-white">{image.title}</span>
                            {image.tag && (
                              <span className="mt-1 rounded-full bg-white/20 px-2 py-0.5 text-xs text-white backdrop-blur-sm">
                                {image.tag}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Delete button for admin */}
                      {isAdmin && (
                        <div className="absolute right-2 top-2 z-10 opacity-0 transition-opacity group-hover:opacity-100">
                          {deleteConfirm === image.id ? (
                            <div className="flex gap-1">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDelete(image.id) }}
                                className="flex h-7 w-7 items-center justify-center rounded-full bg-destructive text-white shadow-md transition-transform hover:scale-110"
                                title="确认删除"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setDeleteConfirm(null) }}
                                className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-foreground shadow-md text-xs font-bold"
                                title="取消"
                              >
                                X
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); setDeleteConfirm(image.id) }}
                              className="flex h-7 w-7 items-center justify-center rounded-full bg-white/80 text-muted-foreground shadow-md transition-transform hover:scale-110 hover:text-destructive"
                              title="删除"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                共 {filteredImages.length} 张图片
              </p>
            </>
          )}
        </div>

        {/* Lightbox */}
        <AnimatePresence>
          {lightboxIndex !== null && filteredImages[lightboxIndex] && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm"
              onClick={closeLightbox}
              onKeyDown={handleKeyDown}
              tabIndex={-1}
              ref={(el) => el?.focus()}
            >
              <button
                onClick={closeLightbox}
                className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              >
                <X className="h-5 w-5" />
              </button>

              <button
                onClick={(e) => { e.stopPropagation(); goPrev() }}
                className="absolute left-4 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>

              <motion.div
                key={lightboxIndex}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.25 }}
                className="relative max-h-[85vh] max-w-[90vw]"
                onClick={(e) => e.stopPropagation()}
              >
                <img
                  src={filteredImages[lightboxIndex].url}
                  alt={filteredImages[lightboxIndex].title}
                  crossOrigin="anonymous"
                  referrerPolicy="no-referrer"
                  className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain"
                />
                <div className="absolute bottom-0 left-0 right-0 rounded-b-lg bg-gradient-to-t from-black/60 to-transparent px-6 py-4">
                  <p className="text-center text-sm font-medium text-white">
                    {filteredImages[lightboxIndex].title}
                  </p>
                  {filteredImages[lightboxIndex].tag && (
                    <p className="mt-1 text-center text-xs text-white/60">
                      {filteredImages[lightboxIndex].tag}
                    </p>
                  )}
                  <p className="text-center text-xs text-white/40">
                    {lightboxIndex + 1} / {filteredImages.length}
                  </p>
                </div>
              </motion.div>

              <button
                onClick={(e) => { e.stopPropagation(); goNext() }}
                className="absolute right-4 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <Footer />
    </div>
  )
}
