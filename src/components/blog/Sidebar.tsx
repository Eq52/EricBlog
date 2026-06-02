'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Clock, FolderOpen, Tag, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store'
import { TAG_COLORS } from '@/lib/constants'

// ---------------------------------------------------------------------------
// Typing Effect (Aurora style)
// ---------------------------------------------------------------------------
function TypingText({ texts, speed = 80, deleteSpeed = 40, pauseTime = 2000 }: {
  texts: string[]
  speed?: number
  deleteSpeed?: number
  pauseTime?: number
}) {
  const [displayText, setDisplayText] = useState('')
  const [textIndex, setTextIndex] = useState(0)
  const [charIndex, setCharIndex] = useState(0)
  const [isDeleting, setIsDeleting] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    const currentText = texts[textIndex] || ''

    const timer = setTimeout(() => {
      if (!isDeleting) {
        if (charIndex < currentText.length) {
          setDisplayText(currentText.slice(0, charIndex + 1))
          setCharIndex(charIndex + 1)
        } else {
          setTimeout(() => setIsDeleting(true), pauseTime)
        }
      } else {
        if (charIndex > 0) {
          setDisplayText(currentText.slice(0, charIndex - 1))
          setCharIndex(charIndex - 1)
        } else {
          setIsDeleting(false)
          setTextIndex((textIndex + 1) % texts.length)
        }
      }
    }, isDeleting ? deleteSpeed : speed)

    return () => clearTimeout(timer)
  }, [mounted, charIndex, isDeleting, textIndex, texts, speed, deleteSpeed, pauseTime])

  if (!mounted) return null

  return (
    <span>
      {displayText}
      <span className="typing-cursor" />
    </span>
  )
}

// ---------------------------------------------------------------------------
// Sidebar Component
// ---------------------------------------------------------------------------
export default function Sidebar() {
  const { navigate, selectedCategory, setSelectedCategory, user } = useAppStore()
  const [recentArticles, setRecentArticles] = useState<{ id: string; title: string; createdAt: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [articleTotal, setArticleTotal] = useState(0)
  const [categories, setCategories] = useState<string[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [mounted, setMounted] = useState(false)
  const [runtimeDays, setRuntimeDays] = useState<number | null>(null)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    const fetchMeta = async () => {
      try {
        const [statsRes, metaRes] = await Promise.all([
          fetch('/api/stats'),
          fetch('/api/articles/meta'),
        ])
        if (statsRes.ok) {
          const data = await statsRes.json()
          setArticleTotal(data.published || 0)
          // 从 init 时间计算运行天数
          if (data.siteCreatedAt) {
            const start = new Date(data.siteCreatedAt).getTime()
            const days = Math.max(0, Math.floor((Date.now() - start) / (1000 * 60 * 60 * 24)))
            setRuntimeDays(days)
            // 每分钟刷新一次天数
            const interval = setInterval(() => {
              setRuntimeDays(Math.max(0, Math.floor((Date.now() - start) / (1000 * 60 * 60 * 24))))
            }, 60000)
          }
        }
        if (metaRes.ok) {
          const data = await metaRes.json()
          setCategories(data.categories || [])
          setTags(data.tags || [])
        }
      } catch { /* ignore */ }
    }
    fetchMeta()
  }, [])

  useEffect(() => {
    const fetchRecent = async () => {
      try {
        const res = await fetch('/api/articles?page=1&limit=5')
        const data = await res.json()
        setRecentArticles(data.articles || [])
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }
    fetchRecent()
  }, [])

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  }

  const animDelay = (index: number) => ({
    animationDelay: `${index * 0.1}s`,
    animationFillMode: 'both' as const,
  })

  return (
    <aside className={cn("hidden lg:block w-72 shrink-0 space-y-0", !mounted && "lg:invisible")}>
      {/* Profile Card */}
      <div className="sidebar-card sidebar-animate" style={animDelay(0)}>
        <div className="p-5 text-center">
          <div className="mx-auto mb-3 flex justify-center">
            <div className="relative">
              <img
                src="/avatar.jpg"
                alt="Eric"
                className="h-24 w-24 rounded-full border-[3px] border-white object-cover shadow-lg dark:border-neutral-700"
              />
            </div>
          </div>
          <h3 className="text-base font-bold">{user?.name || 'Eric'}</h3>
          <div className="mt-2 min-h-[28px] text-sm text-muted-foreground">
            <TypingText
              texts={[
                '记录技术，分享知识',
                '探索前沿，持续学习',
                '热爱编程，热爱生活',
                'Code is poetry',
              ]}
            />
          </div>
          {user?.email && (
            <p className="mt-1 text-xs text-muted-foreground/60">{user.email}</p>
          )}
        </div>
      </div>

      {/* Categories Widget */}
      <div className="sidebar-card sidebar-animate" style={animDelay(2)}>
        <div className="p-4">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
            分类
          </h4>
          <div className="space-y-1">
            {categories.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground/50">暂无分类</p>
            ) : (
              categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => { setSelectedCategory(cat); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-sm transition-all hover:bg-muted ${
                    selectedCategory === cat ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  <span>{cat}</span>
                  {selectedCategory === cat && <span className="h-1.5 w-1.5 rounded-full bg-foreground" />}
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent Posts Widget */}
      <div className="sidebar-card sidebar-animate" style={animDelay(3)}>
        <div className="p-4">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Clock className="h-4 w-4 text-muted-foreground" />
            最新文章
          </h4>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton-shimmer h-4 w-full rounded bg-muted" />
              ))}
            </div>
          ) : recentArticles.length > 0 ? (
            <div className="space-y-0 divide-y divide-border/50">
              {recentArticles.map((article) => (
                <a
                  key={article.id}
                  href={`/article/${article.id}`}
                  className="flex items-start justify-between py-2.5 text-sm transition-colors hover:text-foreground group"
                >
                  <span className="line-clamp-1 flex-1 text-muted-foreground group-hover:text-foreground transition-colors">
                    {article.title}
                  </span>
                  <span className="ml-2 shrink-0 text-xs text-muted-foreground/50">
                    {formatDate(article.createdAt)}
                  </span>
                </a>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">暂无文章</p>
          )}
        </div>
      </div>

      {/* Tag Cloud Widget */}
      <div className="sidebar-card sidebar-animate" style={animDelay(4)}>
        <div className="p-4">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Tag className="h-4 w-4 text-muted-foreground" />
            标签云
          </h4>
          <div className="flex flex-wrap">
            {tags.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground/50">暂无标签</p>
            ) : (
              tags.map((tag, i) => (
                <span
                  key={tag}
                  className="tag-cloud-item"
                  style={{
                    color: TAG_COLORS[i % TAG_COLORS.length],
                    backgroundColor: TAG_COLORS[i % TAG_COLORS.length] + '18',
                    borderColor: TAG_COLORS[i % TAG_COLORS.length] + '30',
                  }}
                >
                  {tag}
                </span>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Mini Stats */}
      <div className="sidebar-card sidebar-animate" style={animDelay(5)}>
        <div className="p-4">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            站点信息
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: '文章', value: articleTotal, icon: '📝' },
              { label: '分类', value: categories.length, icon: '📁' },
              { label: '标签', value: tags.length, icon: '🏷️' },
              { label: '运行天数', value: runtimeDays ?? '-', icon: '🚀' },
            ].map((stat) => (
              <div key={stat.label} className="rounded-lg bg-muted/50 p-2.5 text-center">
                <div className="text-lg font-bold">{stat.value}</div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  )
}
