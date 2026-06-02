'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  User,
  Mail,
  ShieldCheck,
  Edit3,
  Save,
  MessageSquare,
  Loader2,
  FileText,
  Lock,
  KeyRound,
  Settings,
  Globe,
  Plus,
  X,
  ImageIcon,
  Upload,
  Link2,
  FileUp,
  Eye,
  Sparkles,
  Zap,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/hooks/use-toast'
import { useAppStore } from '@/store'

type ProfileTab = 'profile' | 'settings' | 'admin'

const tabLabels: Record<ProfileTab, string> = {
  profile: '个人信息',
  settings: '账户设置',
  admin: '管理概览',
}

export default function ProfileView() {
  const { user, token, setAuth, navigate } = useAppStore()
  const isAdmin = user?.role === 'admin'

  // Tab state
  const [activeTab, setActiveTab] = useState<ProfileTab>('profile')

  // Admin settings state
  const [showSettings, setShowSettings] = useState(false)
  const [newEmail, setNewEmail] = useState(user?.email || '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingSettings, setSavingSettings] = useState(false)

  // Domain whitelist state
  const [allowedDomains, setAllowedDomains] = useState<string[]>([])
  const [newDomain, setNewDomain] = useState('')
  const [savingDomains, setSavingDomains] = useState(false)
  const [loadingDomains, setLoadingDomains] = useState(true)

  // Landing background state
  const [landingBackground, setLandingBackground] = useState('')
  const [bgInputMode, setBgInputMode] = useState<'url' | 'upload'>('url')
  const [bgUrlInput, setBgUrlInput] = useState('')
  const [savingBg, setSavingBg] = useState(false)
  const [loadingBg, setLoadingBg] = useState(true)
  const bgFileInputRef = useRef<HTMLInputElement>(null)
  const [uploadingBg, setUploadingBg] = useState(false)

  // AI config state
  const [aiProvider, setAiProvider] = useState('openai')
  const [aiApiKey, setAiApiKey] = useState('')
  const [aiApiBase, setAiApiBase] = useState('')
  const [aiModel, setAiModel] = useState('')
  const [aiConfigured, setAiConfigured] = useState(false)
  const [aiKeyMasked, setAiKeyMasked] = useState('')
  const [savingAi, setSavingAi] = useState(false)
  const [aiTestLoading, setAiTestLoading] = useState(false)
  const [aiTestResult, setAiTestResult] = useState<{ ok: boolean; msg: string } | null>(null)

  const [comments, setComments] = useState([])
  const [loadingComments, setLoadingComments] = useState(false)

  // Admin stats state
  const [stats, setStats] = useState({ articles: 0, published: 0, comments: 0, totalViews: 0 })
  const [loadingStats, setLoadingStats] = useState(true)

  // Load allowed domains and landing background
  const fetchDomains = useCallback(async () => {
    if (!isAdmin || !token) return
    setLoadingDomains(true)
    setLoadingBg(true)
    setLoadingStats(true)
    setLoadingComments(true)
    try {
      const res = await fetch('/api/admin/settings', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (res.ok) {
        setAllowedDomains(data.allowedDomains || [])
        setLandingBackground(data.landingBackground || '')
        setBgUrlInput(data.landingBackground || '')
        // 加载 AI 配置状态
        if (data.aiConfig) {
          setAiProvider(data.aiConfig.provider || 'openai')
          setAiApiBase(data.aiConfig.apiBase || '')
          setAiModel(data.aiConfig.model || '')
          setAiConfigured(true)
          setAiKeyMasked(data.aiConfig.apiKeyMasked || '')
        } else {
          setAiConfigured(false)
        }
      }
    } catch {
      // ignore
    } finally {
      setLoadingDomains(false)
      setLoadingBg(false)
    }

    // Fetch stats
    try {
      const res = await fetch('/api/stats')
      if (res.ok) {
        const data = await res.json()
        setStats({
          articles: data.articles || 0,
          published: data.published || 0,
          comments: data.comments || 0,
          totalViews: data.totalViews || 0,
        })
      }
    } catch {
      // ignore
    } finally {
      setLoadingStats(false)
    }

    // Fetch recent comments
    try {
      const res = await fetch('/api/comments?global=true&limit=10')
      if (res.ok) {
        const data = await res.json()
        setComments(data.comments || [])
      }
    } catch {
      setComments([])
    } finally {
      setLoadingComments(false)
    }
  }, [isAdmin, token])

  useEffect(() => {
    fetchDomains()
  }, [fetchDomains])

  // Redirect to login if not authenticated (useEffect to avoid render-time side effect)
  useEffect(() => {
    if (!user || !token) {
      navigate('login')
    }
  }, [user, token, navigate])

  if (!user || !token) {
    return null
  }

  // Add domain
  const handleAddDomain = () => {
    const trimmed = newDomain.trim()
    if (!trimmed) return
    // 简单验证
    const d = trimmed.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
    if (!d.includes('.') || d.startsWith('.') || d.endsWith('.')) {
      toast({ title: '域名格式不正确', variant: 'destructive' })
      return
    }
    if (allowedDomains.includes(d)) {
      toast({ title: '该域名已存在', variant: 'destructive' })
      return
    }
    setAllowedDomains([...allowedDomains, d])
    setNewDomain('')
  }

  // Remove domain
  const handleRemoveDomain = (domain: string) => {
    setAllowedDomains(allowedDomains.filter((d) => d !== domain))
  }

  // Save domains
  const handleSaveDomains = async () => {
    if (!isAdmin || !token) return
    setSavingDomains(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ allowedDomains }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: data.error || '保存失败', variant: 'destructive' })
        return
      }
      toast({ title: data.message || '域名白名单已更新！' })
    } catch {
      toast({ title: '保存失败', variant: 'destructive' })
    } finally {
      setSavingDomains(false)
    }
  }

  // Save landing background URL
  const handleSaveBg = async (url: string) => {
    if (!isAdmin || !token) return
    setSavingBg(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ landingBackground: url }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: data.error || '保存失败', variant: 'destructive' })
        return
      }
      setLandingBackground(url)
      setBgUrlInput(url)
      toast({ title: url ? '着陆页背景已更新！' : '着陆页背景已恢复默认' })
    } catch {
      toast({ title: '保存失败', variant: 'destructive' })
    } finally {
      setSavingBg(false)
    }
  }

  // Upload background image
  const handleUploadBg = async () => {
    if (!isAdmin || !token) return
    const file = bgFileInputRef.current?.files?.[0]
    if (!file) return

    setUploadingBg(true)
    try {
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

      await handleSaveBg(uploadData.url)
      if (bgFileInputRef.current) bgFileInputRef.current.value = ''
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '上传失败'
      toast({ title: message, variant: 'destructive' })
    } finally {
      setUploadingBg(false)
    }
  }

  // AI 预设快速填充
  const aiPresets: Record<string, { base: string; model: string }> = {
    spark: { base: 'https://spark-api-open.xf-yun.com/v1/chat/completions', model: 'lite' },
    openai: { base: 'https://api.openai.com', model: 'gpt-4o-mini' },
    deepseek: { base: 'https://api.deepseek.com', model: 'deepseek-chat' },
    moonshot: { base: 'https://api.moonshot.cn', model: 'moonshot-v1-8k' },
    qwen: { base: 'https://dashscope.aliyuncs.com/compatible-mode', model: 'qwen-turbo' },
    zhipu: { base: 'https://open.bigmodel.cn/api/paas', model: 'glm-4-flash' },
    custom: { base: '', model: '' },
  }

  const handlePresetSelect = (key: string) => {
    const preset = aiPresets[key]
    if (preset) {
      setAiProvider(key)
      setAiApiBase(preset.base)
      setAiModel(preset.model)
      setAiTestResult(null)
    }
  }

  // 保存 AI 配置
  const handleSaveAiConfig = async () => {
    if (!isAdmin || !token) return
    if (!aiApiKey.trim() || !aiApiBase.trim()) {
      toast({ title: '请填写 API Key 和接口地址', variant: 'destructive' })
      return
    }
    setSavingAi(true)
    setAiTestResult(null)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          aiConfig: {
            provider: aiProvider,
            apiKey: aiApiKey.trim(),
            apiBase: aiApiBase.trim(),
            model: aiModel.trim(),
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: data.error || '保存失败', variant: 'destructive' })
        return
      }
      setAiConfigured(true)
      setAiKeyMasked(aiApiKey.length > 8 ? aiApiKey.slice(0, 4) + '****' + aiApiKey.slice(-4) : '****')
      setAiApiKey('')
      toast({ title: 'AI 配置已保存！' })
    } catch {
      toast({ title: '保存失败', variant: 'destructive' })
    } finally {
      setSavingAi(false)
    }
  }

  // 测试 AI 连通性
  const handleTestAi = async () => {
    if (!token) return
    setAiTestLoading(true)
    setAiTestResult(null)
    try {
      const res = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          content: '这是一篇测试文章，用于验证AI功能是否正常工作。',
          type: 'summary',
        }),
      })
      const data = await res.json()
      if (res.ok && data.result) {
        setAiTestResult({ ok: true, msg: `测试成功: ${data.result.slice(0, 50)}...` })
      } else {
        setAiTestResult({ ok: false, msg: data.error || '测试失败' })
      }
    } catch {
      setAiTestResult({ ok: false, msg: '连接失败，请检查配置' })
    } finally {
      setAiTestLoading(false)
    }
  }

  // 清除 AI 配置
  const handleClearAiConfig = async () => {
    if (!isAdmin || !token) return
    setSavingAi(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ aiConfig: null }),
      })
      if (res.ok) {
        setAiConfigured(false)
        setAiKeyMasked('')
        setAiApiKey('')
        setAiApiBase('')
        setAiModel('')
        setAiProvider('openai')
        setAiTestResult(null)
        toast({ title: 'AI 配置已清除' })
      }
    } catch {
      toast({ title: '操作失败', variant: 'destructive' })
    } finally {
      setSavingAi(false)
    }
  }

  const handleSaveSettings = async () => {
    if (!isAdmin || !token) return

    // 验证输入
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (newEmail.trim() && !emailRegex.test(newEmail.trim())) {
      toast({ title: '邮箱格式不正确', variant: 'destructive' })
      return
    }

    if (newPassword) {
      if (!currentPassword) {
        toast({ title: '修改密码需要输入当前密码', variant: 'destructive' })
        return
      }
      if (newPassword.length < 6) {
        toast({ title: '新密码至少需要6个字符', variant: 'destructive' })
        return
      }
      if (newPassword !== confirmPassword) {
        toast({ title: '两次输入的密码不一致', variant: 'destructive' })
        return
      }
    }

    setSavingSettings(true)
    try {
      const body: Record<string, string> = {}
      if (newEmail.trim() && newEmail.trim() !== user.email) {
        body.email = newEmail.trim()
      }
      if (newPassword) {
        body.currentPassword = currentPassword
        body.newPassword = newPassword
      }

      // 如果没有修改内容
      if (Object.keys(body).length === 0) {
        toast({ title: '没有需要保存的修改', variant: 'destructive' })
        setSavingSettings(false)
        return
      }

      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok) {
        toast({ title: data.error || '保存失败', variant: 'destructive' })
        return
      }

      // 更新 store 中的用户信息和 token
      if (data.user && data.token) {
        setAuth(data.user, data.token)
      }

      // 重置表单
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      toast({ title: data.message || '设置已更新！' })
    } catch {
      toast({ title: '保存失败', variant: 'destructive' })
    } finally {
      setSavingSettings(false)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  // Tab animation variants
  const tabVariants = {
    hidden: { opacity: 0, y: 8 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } },
    exit: { opacity: 0, y: -8, transition: { duration: 0.15, ease: 'easeIn' } },
  }

  // Recent Comments component (shared between profile and admin tabs)
  const renderRecentComments = () => (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          最近评论
        </h3>
      </CardHeader>
      <CardContent>
        {loadingComments ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-16 w-full" />
              </div>
            ))}
          </div>
        ) : comments.length === 0 ? (
          <div className="py-8 text-center">
            <MessageSquare className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">暂无评论</p>
          </div>
        ) : (
          <div className="space-y-3">
            {comments.map((comment, i) => (
              <div key={comment.articleId + '-' + i} className="rounded-lg border border-border/50 p-3">
                <div className="mb-1 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-foreground">{comment.authorName || '匿名'}</span>
                    {comment.articleTitle && (
                      <span className="text-xs text-muted-foreground">
                        评论于《{comment.articleTitle.length > 10 ? comment.articleTitle.slice(0, 10) + '...' : comment.articleTitle}》
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(comment.createdAt)}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-foreground/85">{comment.content}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mx-auto max-w-3xl px-4 py-6 sm:px-6"
    >
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('home')}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">我的主页</h1>
      </div>

      {/* Tab Buttons - only shown for admin users */}
      {isAdmin && (
        <div className="mb-6 flex gap-1.5">
          {(['profile', 'settings', 'admin'] as ProfileTab[]).map((tab) => (
            <Button
              key={tab}
              variant="ghost"
              size="sm"
              onClick={() => setActiveTab(tab)}
              className={`rounded-full font-medium transition-all ${
                activeTab === tab
                  ? 'bg-foreground text-background shadow-md'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {tabLabels[tab]}
            </Button>
          ))}
        </div>
      )}

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {/* ===== 个人信息 Tab ===== */}
        {(activeTab === 'profile' || !isAdmin) && (
          <motion.div
            key="tab-profile"
            variants={tabVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="space-y-6"
          >
            {/* Profile Card */}
            <Card className="border-border/50">
              <CardContent className="p-6">
                <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                  <Avatar className="h-20 w-20">
                    <AvatarFallback className="bg-muted text-xl font-bold text-foreground">
                      {user.name?.slice(0, 2).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-center sm:text-left">
                    <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-center">
                      <h2 className="text-xl font-bold">{user.name}</h2>
                      <Badge
                        variant="secondary"
                        className={
                          user.role === 'admin'
                            ? 'bg-muted text-foreground'
                            : ''
                        }
                      >
                        {user.role === 'admin' ? (
                          <span className="flex items-center gap-1">
                            <ShieldCheck className="h-3 w-3" />
                            管理员
                          </span>
                        ) : (
                          '用户'
                        )}
                      </Badge>
                    </div>
                    <div className="mt-1 flex flex-col items-center gap-1 sm:flex-row sm:gap-4">
                      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Mail className="h-3.5 w-3.5" />
                        {user.email}
                      </span>
                    </div>
                  </div>
                </div>

                <Separator className="my-5" />
              </CardContent>
            </Card>

            {/* Recent Comments */}
            {renderRecentComments()}
          </motion.div>
        )}

        {/* ===== 账户设置 Tab (admin only) ===== */}
        {isAdmin && activeTab === 'settings' && (
          <motion.div
            key="tab-settings"
            variants={tabVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="space-y-6"
          >
            {/* Admin Settings - 修改邮箱和密码 */}
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <Settings className="h-4 w-4 text-foreground" />
                    账户设置
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowSettings(!showSettings)
                      if (showSettings) {
                        setNewEmail(user?.email || '')
                        setCurrentPassword('')
                        setNewPassword('')
                        setConfirmPassword('')
                      }
                    }}
                    className="h-7 gap-1.5 text-xs"
                  >
                    {showSettings ? '收起' : (
                      <>
                        <Edit3 className="h-3 w-3" />
                        修改
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
              {showSettings && (
                <CardContent className="space-y-5">
                  {/* 修改邮箱 */}
                  <div className="space-y-2">
                    <Label htmlFor="settings-email" className="flex items-center gap-2 text-sm font-medium">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                      邮箱
                    </Label>
                    <Input
                      id="settings-email"
                      type="email"
                      placeholder="输入新邮箱..."
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="h-9"
                    />
                  </div>

                  <Separator />

                  {/* 修改密码 */}
                  <div className="space-y-3">
                    <Label className="flex items-center gap-2 text-sm font-medium">
                      <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
                      修改密码
                    </Label>
                    <div className="space-y-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="current-pwd" className="text-xs text-muted-foreground">
                          当前密码
                        </Label>
                        <Input
                          id="current-pwd"
                          type="password"
                          placeholder="输入当前密码..."
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor="new-pwd" className="text-xs text-muted-foreground">
                            新密码
                          </Label>
                          <Input
                            id="new-pwd"
                            type="password"
                            placeholder="至少6个字符..."
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="h-9"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="confirm-pwd" className="text-xs text-muted-foreground">
                            确认新密码
                          </Label>
                          <Input
                            id="confirm-pwd"
                            type="password"
                            placeholder="再次输入新密码..."
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="h-9"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={handleSaveSettings}
                      disabled={savingSettings}
                      className="gap-1.5 bg-foreground text-background hover:bg-foreground/90"
                    >
                      {savingSettings ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Lock className="h-3.5 w-3.5" />
                      )}
                      保存设置
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>

            {/* API 域名白名单 */}
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <Globe className="h-4 w-4 text-foreground" />
                  API 域名白名单
                </h3>
                <p className="text-xs text-muted-foreground">
                  设置允许访问 API 的域名。白名单为空时不做限制。仅精确匹配填写的域名。
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {loadingDomains ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">加载中...</span>
                  </div>
                ) : (
                  <>
                    {/* Domain list */}
                    <div className="flex flex-wrap gap-2">
                      {allowedDomains.length === 0 ? (
                        <span className="text-xs text-muted-foreground py-1">暂无域名，白名单为空时允许所有来源访问 API</span>
                      ) : (
                        allowedDomains.map((domain) => (
                          <span
                            key={domain}
                            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium"
                          >
                            {domain}
                            <button
                              onClick={() => handleRemoveDomain(domain)}
                              className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-muted hover:text-destructive"
                              title="移除"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))
                      )}
                    </div>

                    {/* Add domain input */}
                    <div className="flex gap-2">
                      <Input
                        placeholder="输入域名，如 blog.example.com"
                        value={newDomain}
                        onChange={(e) => setNewDomain(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleAddDomain()
                          }
                        }}
                        className="h-9 flex-1 text-sm"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleAddDomain}
                        disabled={!newDomain.trim()}
                        className="h-9 gap-1.5"
                      >
                        <Plus className="h-3 w-3" />
                        添加
                      </Button>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {allowedDomains.length} 个域名
                        {allowedDomains.length === 0 && ' (当前无限制)'}
                      </span>
                      <Button
                        size="sm"
                        onClick={handleSaveDomains}
                        disabled={savingDomains}
                        className="gap-1.5 bg-foreground text-background hover:bg-foreground/90"
                      >
                        {savingDomains ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Save className="h-3.5 w-3.5" />
                        )}
                        保存域名
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Landing Background Settings */}
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <ImageIcon className="h-4 w-4 text-foreground" />
                  着陆页背景
                </h3>
                <p className="text-xs text-muted-foreground">
                  设置着陆页的视频或图片背景。支持 mp4/webm 视频链接或图片链接，留空则使用默认背景。
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {loadingBg ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">加载中...</span>
                  </div>
                ) : (
                  <>
                    {/* Current background preview */}
                    {landingBackground && (
                      <div className="relative overflow-hidden rounded-lg border border-border/50">
                        {/\.mp4|\.webm|\.ogg|\.mov/i.test(landingBackground) ? (
                          <video
                            src={landingBackground}
                            muted
                            className="h-32 w-full object-cover sm:h-40"
                          />
                        ) : (
                          <img
                            src={landingBackground}
                            alt="当前背景"
                            className="h-32 w-full object-cover sm:h-40"
                          />
                        )}
                        <button
                          onClick={() => handleSaveBg('')}
                          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-black/80"
                          title="恢复默认"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Input mode tabs */}
                    <div className="flex gap-1 rounded-lg bg-muted p-0.5">
                      <button
                        onClick={() => setBgInputMode('url')}
                        className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                          bgInputMode === 'url'
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <Link2 className="h-3.5 w-3.5" />
                        外部链接
                      </button>
                      <button
                        onClick={() => setBgInputMode('upload')}
                        className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                          bgInputMode === 'upload'
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <FileUp className="h-3.5 w-3.5" />
                        上传图片
                      </button>
                    </div>

                    {bgInputMode === 'url' ? (
                      <div className="space-y-3">
                        <Input
                          placeholder="输入视频或图片URL..."
                          value={bgUrlInput}
                          onChange={(e) => setBgUrlInput(e.target.value)}
                          className="h-9 text-sm"
                        />
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            {landingBackground ? '已设置自定义背景' : '使用默认背景'}
                          </span>
                          <div className="flex gap-2">
                            {bgUrlInput && bgUrlInput !== landingBackground && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleSaveBg('')}
                                className="h-8 gap-1 text-xs"
                              >
                                恢复默认
                              </Button>
                            )}
                            <Button
                              size="sm"
                              onClick={() => handleSaveBg(bgUrlInput.trim())}
                              disabled={savingBg || !bgUrlInput.trim()}
                              className="gap-1.5 bg-foreground text-background hover:bg-foreground/90"
                            >
                              {savingBg ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Save className="h-3 w-3" />
                              )}
                              保存
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <input
                          ref={bgFileInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          className="hidden"
                          onChange={() => handleUploadBg()}
                        />
                        <Button
                          variant="outline"
                          onClick={() => bgFileInputRef.current?.click()}
                          disabled={uploadingBg}
                          className="w-full gap-2"
                        >
                          {uploadingBg ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4" />
                          )}
                          {uploadingBg ? '上传中...' : '选择图片并上传'}
                        </Button>
                        <p className="text-xs text-muted-foreground">
                          上传图片将自动保存为着陆页背景
                        </p>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* AI 配置 */}
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-semibold">
                      <Sparkles className="h-4 w-4 text-foreground" />
                      AI 助手配置
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      配置 AI 服务用于文章标题、摘要、标签的自动生成。支持 OpenAI 兼容格式的各家 API。
                    </p>
                  </div>
                  {aiConfigured && (
                    <Badge variant="secondary" className="gap-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      <CheckCircle2 className="h-3 w-3" />
                      已配置
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 服务商快速选择 */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">服务商</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(aiPresets).map(([key]) => {
                      const labels: Record<string, string> = {
                        spark: '讯飞星火',
                        openai: 'OpenAI',
                        deepseek: 'DeepSeek',
                        moonshot: 'Moonshot',
                        qwen: '通义千问',
                        zhipu: '智谱 GLM',
                        custom: '自定义',
                      }
                      return (
                        <button
                          key={key}
                          onClick={() => handlePresetSelect(key)}
                          className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                            aiProvider === key
                              ? 'border-foreground bg-foreground text-background'
                              : 'border-border text-muted-foreground hover:border-foreground/50 hover:text-foreground'
                          }`}
                        >
                          {labels[key] || key}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* API Key */}
                <div className="space-y-2">
                  <Label htmlFor="ai-apikey" className="text-sm font-medium">
                    <Zap className="mr-1 inline h-3.5 w-3.5 text-muted-foreground" />
                    API Key
                  </Label>
                  <Input
                    id="ai-apikey"
                    type="password"
                    placeholder={aiConfigured ? `当前: ${aiKeyMasked}（重新填写以覆盖）` : '输入 API Key...'}
                    value={aiApiKey}
                    onChange={(e) => setAiApiKey(e.target.value)}
                    className="h-9 font-mono text-sm"
                  />
                </div>

                {/* API Base */}
                <div className="space-y-2">
                  <Label htmlFor="ai-base" className="text-sm font-medium">
                    接口地址
                  </Label>
                  <Input
                    id="ai-base"
                    placeholder="https://api.openai.com"
                    value={aiApiBase}
                    onChange={(e) => setAiApiBase(e.target.value)}
                    className="h-9 font-mono text-xs"
                  />
                  <p className="text-xs text-muted-foreground">
                    OpenAI 兼容格式。填写 Base URL 即可（系统自动拼接 /v1/chat/completions）。例如 https://api.openai.com、https://api.deepseek.com、http://localhost:11434 等。如已包含完整路径则直接使用。
                  </p>
                </div>

                {/* Model */}
                <div className="space-y-2">
                  <Label htmlFor="ai-model" className="text-sm font-medium">
                    模型名称
                  </Label>
                  <Input
                    id="ai-model"
                    placeholder="gpt-4o-mini"
                    value={aiModel}
                    onChange={(e) => setAiModel(e.target.value)}
                    className="h-9 font-mono text-xs"
                  />
                </div>

                {/* Test result */}
                {aiTestResult && (
                  <div className={`flex items-start gap-2 rounded-lg border p-3 text-xs ${
                    aiTestResult.ok
                      ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400'
                      : 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400'
                  }`}>
                    {aiTestResult.ok ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    ) : (
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    )}
                    <span>{aiTestResult.msg}</span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleSaveAiConfig}
                      disabled={savingAi || !aiApiKey.trim()}
                      className="gap-1.5 bg-foreground text-background hover:bg-foreground/90"
                    >
                      {savingAi ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Save className="h-3.5 w-3.5" />
                      )}
                      保存 AI 配置
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleTestAi}
                      disabled={aiTestLoading || !aiConfigured}
                      className="gap-1.5"
                    >
                      {aiTestLoading ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Sparkles className="h-3 w-3" />
                      )}
                      测试连接
                    </Button>
                  </div>
                  {aiConfigured && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearAiConfig}
                      disabled={savingAi}
                      className="gap-1 text-xs text-destructive hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                      清除
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ===== 管理概览 Tab (admin only) ===== */}
        {isAdmin && activeTab === 'admin' && (
          <motion.div
            key="tab-admin"
            variants={tabVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="space-y-6"
          >
            {/* Admin Stats */}
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <ShieldCheck className="h-4 w-4 text-foreground" />
                  管理员概览
                </h3>
              </CardHeader>
              <CardContent>
                {loadingStats ? (
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
                        <Skeleton className="h-5 w-5 rounded" />
                        <div className="space-y-1">
                          <Skeleton className="h-5 w-10" />
                          <Skeleton className="h-3 w-8" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
                      <FileText className="h-5 w-5 text-foreground" />
                      <div>
                        <p className="text-lg font-bold">{stats.articles}</p>
                        <p className="text-xs text-muted-foreground">文章 ({stats.published} 已发布)</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
                      <MessageSquare className="h-5 w-5 text-foreground" />
                      <div>
                        <p className="text-lg font-bold">{stats.comments}</p>
                        <p className="text-xs text-muted-foreground">评论</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
                      <Eye className="h-5 w-5 text-foreground" />
                      <div>
                        <p className="text-lg font-bold">{stats.totalViews.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">浏览量</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Comments */}
            {renderRecentComments()}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
