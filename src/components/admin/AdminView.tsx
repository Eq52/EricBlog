'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Plus,
  FileText,
  Eye,
  MoreHorizontal,
  Trash2,
  Edit3,
  RefreshCw,
  FileBarChart,
  Search,
  FolderSync,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
import { useAppStore } from '@/store'

interface Article {
  id: string
  title: string
  status: string
  visibility: string
  viewCount: number
  createdAt: string
  author: { id: string; name: string }
}

export default function AdminView() {
  const { user, token, navigate } = useAppStore()
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total: 0, published: 0, drafts: 0 })
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all')
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('home')
      toast({ title: '需要管理员权限', variant: 'destructive' })
    }
  }, [user, navigate])

  const fetchAllArticles = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch('/api/articles?limit=100&page=1', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setArticles(data.articles || [])
    } catch {
      // silent
    }
  }, [token])

  const fetchStats = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch('/api/articles?limit=100', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      const allArticles = data.articles || []
      setStats({
        total: allArticles.length,
        published: allArticles.filter((a: Article) => a.status === 'published').length,
        drafts: allArticles.filter((a: Article) => a.status === 'draft').length,
      })
    } catch {
      // silent
    }
  }, [token])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await Promise.all([fetchAllArticles(), fetchStats()])
      setLoading(false)
    }
    load()
  }, [fetchAllArticles, fetchStats])

  const handleDeleteArticle = async (id: string) => {
    if (!token) return
    try {
      const res = await fetch(`/api/articles/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        toast({ title: '文章已删除' })
        fetchAllArticles()
        fetchStats()
      } else {
        const data = await res.json()
        toast({ title: data.error || '删除失败', variant: 'destructive' })
      }
    } catch {
      toast({ title: '网络错误', variant: 'destructive' })
    }
  }

  const handleToggleStatus = async (article: Article) => {
    if (!token) return
    try {
      const newStatus = article.status === 'published' ? 'draft' : 'published'
      const res = await fetch(`/api/articles/${article.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        toast({ title: newStatus === 'published' ? '文章已发布' : '已取消发布' })
        fetchAllArticles()
        fetchStats()
      }
    } catch {
      toast({ title: '更新失败', variant: 'destructive' })
    }
  }

  const handleSyncMd = async () => {
    if (!token || syncing) return
    setSyncing(true)
    try {
      const res = await fetch('/api/articles/sync-md', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (res.ok) {
        const msg = data.imported > 0
          ? `同步完成：导入 ${data.imported} 篇，跳过 ${data.skipped} 篇`
          : `没有新的 .md 文件需要导入（共 ${data.total} 个文件）`
        toast({ title: msg, description: data.errors?.length ? data.errors.join('\n') : undefined })
        fetchAllArticles()
        fetchStats()
      } else {
        toast({ title: data.error || '同步失败', variant: 'destructive' })
      }
    } catch {
      toast({ title: '同步失败', variant: 'destructive' })
    } finally {
      setSyncing(false)
    }
  }

  const handleToggleVisibility = async (article: Article) => {
    if (!token) return
    const visOrder = ['public', 'auth_only', 'private']
    const visLabels: Record<string, string> = {
      public: '公开',
      auth_only: '仅登录可见',
      private: '私密',
    }
    const idx = visOrder.indexOf(article.visibility)
    const newVis = visOrder[(idx + 1) % visOrder.length]
    try {
      const res = await fetch(`/api/articles/${article.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ visibility: newVis }),
      })
      if (res.ok) {
        toast({ title: `可见性已更改为 ${visLabels[newVis] || newVis}` })
        fetchAllArticles()
      }
    } catch {
      toast({ title: '更新失败', variant: 'destructive' })
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  // Client-side filtering
  const filteredArticles = articles.filter((article) => {
    const matchesSearch = article.title.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || article.status === statusFilter
    return matchesSearch && matchesStatus
  })

  if (!user || user.role !== 'admin') return null

  const statCards = [
    { label: '文章总数', value: stats.total, icon: FileText, color: 'text-foreground bg-muted' },
    { label: '已发布', value: stats.published, icon: RefreshCw, color: 'text-foreground bg-muted' },
    { label: '草稿箱', value: stats.drafts, icon: FileBarChart, color: 'text-foreground bg-muted' },
  ]

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
            onClick={() => navigate('home')}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">管理后台</h1>
            <p className="text-sm text-muted-foreground">管理你的博客内容</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleSyncMd}
            disabled={syncing}
            className="gap-2"
            title="扫描 content/ 目录，将 .md 文件导入数据库"
          >
            {syncing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FolderSync className="h-4 w-4" />}
            {syncing ? '同步中...' : '同步 MD'}
          </Button>
          <Button
            onClick={() => navigate('admin-editor')}
            className="gap-2 bg-foreground text-background hover:bg-foreground/90"
          >
            <Plus className="h-4 w-4" />
            新建文章
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="border-border/50">
              <CardContent className="flex items-center gap-4 p-5">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.color}`}>
                  <stat.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Articles Table */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <Card className="border-border/50">
          <div className="p-4">
            {/* Search & Filter */}
            <div className="mb-4 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="搜索文章标题..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 pl-9"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {(['all', 'published', 'draft'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                      statusFilter === s
                        ? 'bg-foreground text-background shadow-md'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`
                  }
                  >
                    {s === 'all' ? '全部' : s === 'published' ? '已发布' : '草稿'}
                  </button>
                ))}
                <span className="ml-auto text-xs text-muted-foreground">
                  显示 {filteredArticles.length} / {articles.length} 篇文章
                </span>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">标题</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>可见性</TableHead>
                  <TableHead className="text-right">浏览量</TableHead>
                  <TableHead>日期</TableHead>
                  <TableHead className="w-[50px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredArticles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                      {searchQuery || statusFilter !== 'all' ? '没有匹配的文章' : '暂无文章，创建你的第一篇文章！'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredArticles.map((article) => (
                    <TableRow key={article.id}>
                      <TableCell className="font-medium">{article.title}</TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className="bg-muted text-foreground"
                        >
                          {article.status === 'published' ? '已发布' : '草稿'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {article.visibility === 'public' ? '公开' : article.visibility === 'auth_only' ? '仅登录可见' : '私密'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="flex items-center justify-end gap-1 text-muted-foreground">
                          <Eye className="h-3.5 w-3.5" />
                          {article.viewCount}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(article.createdAt)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => navigate('admin-editor', { id: article.id })}
                            >
                              <Edit3 className="mr-2 h-4 w-4" />
                              编辑
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggleStatus(article)}>
                              <RefreshCw className="mr-2 h-4 w-4" />
                              {article.status === 'published' ? '取消发布' : '发布'}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggleVisibility(article)}>
                              <Eye className="mr-2 h-4 w-4" />
                              更改可见性
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => {
                                setDeleteConfirmId(article.id)
                                setDeleteDialogOpen(true)
                              }}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              删除
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            确定要删除这篇文章吗？此操作不可撤销。
          </p>
          {deleteConfirmId && (
            <p className="rounded-md bg-muted px-3 py-2 text-sm font-medium">
              {articles.find((a) => a.id === deleteConfirmId)?.title}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteConfirmId) {
                  handleDeleteArticle(deleteConfirmId)
                  setDeleteDialogOpen(false)
                  setDeleteConfirmId(null)
                }
              }}
            >
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
