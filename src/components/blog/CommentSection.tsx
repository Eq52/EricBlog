'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle, Reply, Send, User as UserIcon, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/hooks/use-toast'
import { useAppStore } from '@/store'

interface Comment {
  id: string
  content: string
  guestName: string | null
  guestEmail: string | null
  parentId: string | null
  createdAt: string
  user: { id: string; name: string; avatar: string | null } | null
  replies: Comment[]
}

interface CommentSectionProps {
  articleId: string
}

export default function CommentSection({ articleId }: CommentSectionProps) {
  const { user, token } = useAppStore()
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Form state
  const [content, setContent] = useState('')
  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [replyTo, setReplyTo] = useState<Comment | null>(null)

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Comment | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  // Guest email verification for deleting guest comments
  const [guestDeleteEmail, setGuestDeleteEmail] = useState('')

  // Pagination state
  const [commentPage, setCommentPage] = useState(1)
  const commentsPerPage = 10

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/comments?articleId=${articleId}`)
      const data = await res.json()
      const flatComments = data.comments || []
      // Build tree
      const tree = flatComments.filter((c: Comment) => !c.parentId)
      const replies = flatComments.filter((c: Comment) => c.parentId)
      tree.forEach((parent: Comment) => {
        parent.replies = replies.filter((r: Comment) => r.parentId === parent.id)
      })
      setComments(tree)
    } catch {
      setComments([])
    } finally {
      setLoading(false)
    }
  }, [articleId])

  useEffect(() => {
    fetchComments()
  }, [fetchComments])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return
    if (!user && (!guestName.trim() || !guestEmail.trim())) {
      toast({ title: '请填写昵称和邮箱', variant: 'destructive' })
      return
    }

    setSubmitting(true)
    try {
      const body: Record<string, string> = {
        articleId,
        content: content.trim(),
      }
      if (replyTo) body.parentId = replyTo.id
      if (!user) {
        body.guestName = guestName.trim()
        body.guestEmail = guestEmail.trim()
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch('/api/comments', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: data.error || '发布失败', variant: 'destructive' })
        return
      }

      setContent('')
      setReplyTo(null)
      setCommentPage(1)
      fetchComments()
      toast({ title: '评论已发布！' })
    } catch {
      toast({ title: '发布失败', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleReply = (comment: Comment) => {
    setReplyTo(comment)
    setContent('')
    // Scroll to form
    document.getElementById('comment-form')?.scrollIntoView({ behavior: 'smooth' })
  }

  const cancelReply = () => {
    setReplyTo(null)
    setContent('')
  }

  const canDeleteComment = (comment: Comment): boolean => {
    // Admin can delete any comment
    if (user?.role === 'admin') return true
    // Logged-in user can delete their own comments
    if (user && comment.user && comment.user.id === user.id) return true
    // Guest can delete their own comments (need email verification)
    if (!user && comment.guestEmail && guestEmail.trim().toLowerCase() === comment.guestEmail.toLowerCase()) return true
    return false
  }

  const handleDeleteClick = (comment: Comment) => {
    setDeleteTarget(comment)
    setGuestDeleteEmail('')
    setDeleteConfirmOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const params = new URLSearchParams({ id: deleteTarget.id })
      // If guest, append guestEmail for verification
      if (!user && deleteTarget.guestEmail) {
        params.set('guestEmail', guestDeleteEmail.trim())
      }

      const headers: Record<string, string> = {}
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch(`/api/comments?${params.toString()}`, {
        method: 'DELETE',
        headers,
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: data.error || '删除失败', variant: 'destructive' })
        return
      }
      toast({ title: '评论已删除' })
      setDeleteConfirmOpen(false)
      setDeleteTarget(null)
      setCommentPage(1)
      fetchComments()
    } catch {
      toast({ title: '删除失败', variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const mins = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    if (mins < 1) return '刚刚'
    if (mins < 60) return `${mins} 分钟前`
    if (hours < 24) return `${hours} 小时前`
    if (days < 30) return `${days} 天前`
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const getInitials = (name: string) => {
    return name.slice(0, 2).toUpperCase()
  }

  const renderComment = (comment: Comment, isReply = false) => (
    <motion.div
      key={comment.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={isReply ? 'ml-8 sm:ml-12 border-l-2 border-foreground/20 pl-4' : ''}
    >
      <div className="flex gap-3 py-4">
        <Avatar className="mt-0.5 h-8 w-8 shrink-0">
          <AvatarFallback className="bg-muted text-xs font-semibold text-foreground">
            {comment.user?.name
              ? getInitials(comment.user.name)
              : comment.guestName
                ? getInitials(comment.guestName)
                : '?'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">
              {comment.user?.name || comment.guestName || '匿名'}
            </span>
            <span className="text-xs text-muted-foreground">{formatDate(comment.createdAt)}</span>
            {isReply && comment.user && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-foreground">
                作者
              </span>
            )}
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-foreground/85 break-words">
            {comment.content}
          </p>
          <div className="mt-2 flex items-center gap-1">
            {!isReply && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleReply(comment)}
                className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <Reply className="h-3 w-3" />
                回复
              </Button>
            )}
            {canDeleteComment(comment) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDeleteClick(comment)}
                className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
                删除
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Nested replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="space-y-0">
          {comment.replies.map((reply) => renderComment(reply, true))}
        </div>
      )}
    </motion.div>
  )

  const totalComments = comments.reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0)

  return (
    <>
    <section>
      <div className="mb-6 flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-foreground" />
        <h2 className="text-xl font-bold">
          评论
          {!loading && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {totalComments} 条评论
            </span>
          )}
        </h2>
      </div>

      {/* Comment Form */}
      <div id="comment-form" className="mb-8 rounded-xl border border-border bg-muted/30 p-4 sm:p-5">
        <AnimatePresence>
          {replyTo && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-3 flex items-center justify-between rounded-lg bg-muted px-3 py-2"
            >
              <span className="text-sm text-foreground">
                回复 <strong>@{replyTo.user?.name || replyTo.guestName || '匿名'}</strong>
              </span>
              <Button variant="ghost" size="sm" onClick={cancelReply} className="h-6 px-2 text-xs">
                取消
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSubmit} className="space-y-3">
          {!user && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="guestName" className="text-xs">
                  昵称 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="guestName"
                  placeholder="你的昵称"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="guestEmail" className="text-xs">
                  邮箱 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="guestEmail"
                  type="email"
                  placeholder="your@email.com"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <div className="flex items-center gap-2 mb-1">
              {user ? (
                <>
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="bg-muted text-[10px] font-bold text-foreground">
                      {getInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">{user.name}</span>
                  <span className="text-xs text-muted-foreground">· 登录用户</span>
                </>
              ) : (
                <>
                  <UserIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">游客</span>
                </>
              )}
            </div>
            <Textarea
              placeholder={
                replyTo
                  ? `回复 @${replyTo.user?.name || replyTo.guestName || '匿名'}...`
                  : '分享你的想法...'
              }
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              size="sm"
              disabled={submitting || !content.trim()}
              className="gap-2 bg-foreground text-background hover:bg-foreground/80"
            >
              <Send className="h-3.5 w-3.5" />
              {submitting ? '发布中...' : '发表评论'}
            </Button>
          </div>
        </form>
      </div>

      {/* Comments List */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-16 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <div className="py-10 text-center">
          <MessageCircle className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">暂无评论，来做第一个留言的人吧！</p>
        </div>
      ) : (
        <div>
          <div className="divide-y divide-border/40">
            <AnimatePresence>
              {comments.slice(0, commentPage * commentsPerPage).map((comment) => renderComment(comment))}
            </AnimatePresence>
          </div>
          {comments.length > commentPage * commentsPerPage && (
            <div className="mt-6 flex flex-col items-center gap-2">
              <span className="text-xs text-muted-foreground">
                还有 {comments.length - commentPage * commentsPerPage} 条评论
              </span>
              <Button
                variant="outline"
                onClick={() => setCommentPage((p) => p + 1)}
                className="mx-auto"
              >
                加载更多评论
              </Button>
            </div>
          )}
        </div>
      )}
    </section>

    {/* Delete Confirmation Dialog */}
    <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            删除评论
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            确定要删除这条评论吗？{deleteTarget?.replies && deleteTarget.replies.length > 0 && '该评论下的回复也会一并删除。'}
          </p>
          {deleteTarget && (
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground mb-1">
                {deleteTarget.user?.name || deleteTarget.guestName || '匿名'}
              </p>
              <p className="text-sm line-clamp-2">{deleteTarget.content}</p>
            </div>
          )}
          {/* Guest email verification */}
          {!user && deleteTarget?.guestEmail && (
            <div className="space-y-1.5">
              <Label htmlFor="delete-email" className="text-xs">
                请输入评论时使用的邮箱以验证身份 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="delete-email"
                type="email"
                placeholder="输入你的邮箱..."
                value={guestDeleteEmail}
                onChange={(e) => setGuestDeleteEmail(e.target.value)}
                className="h-9"
              />
            </div>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDeleteConfirmOpen(false)}
            disabled={deleting}
          >
            取消
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDeleteConfirm}
            disabled={deleting || (!user && deleteTarget?.guestEmail && !guestDeleteEmail.trim())}
          >
            {deleting ? '删除中...' : '确认删除'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}
