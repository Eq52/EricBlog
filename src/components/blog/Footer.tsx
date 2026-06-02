'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Heart, Github, Mail } from 'lucide-react'
import { useAppStore } from '@/store'
import LogoIcon from '@/components/blog/LogoIcon'
import React, { useState, useEffect } from 'react'

// Aurora-style runtime counter (从 /api/init 时间开始计算)
const RuntimeCounter = React.memo(function RuntimeCounter() {
  const [runtime, setRuntime] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>
    let startTs = 0

    const fetchStart = async () => {
      try {
        const res = await fetch('/api/stats')
        if (res.ok) {
          const data = await res.json()
          if (data.siteCreatedAt) {
            startTs = new Date(data.siteCreatedAt).getTime()
          }
        }
      } catch { /* fallback: 用当前时间 */ }
      setLoaded(true)
    }

    const calc = () => {
      if (!startTs) return
      const diff = Date.now() - startTs
      const days = Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)))
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)
      setRuntime({ days, hours, minutes, seconds })
    }

    fetchStart().then(() => {
      calc()
      interval = setInterval(calc, 1000)
    })

    return () => clearInterval(interval)
  }, [])

  if (!loaded || runtime.days === 0 && runtime.hours === 0 && runtime.minutes === 0 && runtime.seconds === 0) {
    return null
  }

  return (
    <span className="text-muted-foreground/60">
      本站已运行 {runtime.days}天{runtime.hours}小时{runtime.minutes}分{runtime.seconds}秒
    </span>
  )
})

export default function Footer() {
  const { navigate } = useAppStore()
  const [categories, setCategories] = useState<string[]>([])

  useEffect(() => {
    fetch('/api/articles/meta')
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setCategories(data.categories || []) })
      .catch(() => {})
  }, [])

  return (
    <footer className="border-t border-border/40 bg-muted/30">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="space-y-3">
            <button
              onClick={() => navigate('home')}
              className="flex items-center gap-2 transition-opacity hover:opacity-80"
            >
              <LogoIcon className="h-8 w-8 rounded-lg" />
              <span className="text-lg font-bold tracking-tight">Eric Blog</span>
            </button>
            <p className="text-sm leading-relaxed text-muted-foreground">
              一个极简主义博客平台，基于 Next.js 构建。在这里记录你的思想与创意。
            </p>
            {/* Runtime counter */}
            <div className="pt-1">
              <p className="text-xs"><RuntimeCounter /></p>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">探索</h3>
            <ul className="space-y-2">
              <li><Link href="/" className="text-sm text-muted-foreground transition-colors hover:text-foreground">首页</Link></li>
              <li><Link href="/gallery" className="text-sm text-muted-foreground transition-colors hover:text-foreground">画廊</Link></li>
              <li><Link href="/about" className="text-sm text-muted-foreground transition-colors hover:text-foreground">关于</Link></li>
            </ul>
          </div>

          {/* Categories */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">分类</h3>
            <ul className="space-y-2">
              {categories.length > 0 ? (
                categories.map((cat) => (
                  <li key={cat}>
                    <button
                      onClick={() => {
                        useAppStore.getState().setSelectedCategory(cat)
                        useAppStore.getState().setSearchQuery('')
                        navigate('home')
                      }}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >{cat}</button>
                  </li>
                ))
              ) : (
                <li><span className="text-sm text-muted-foreground/50">暂无分类</span></li>
              )}
            </ul>
          </div>

          {/* Contact */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">联系我们</h3>
            <div className="flex gap-3">
              <a href="https://github.com/Eq52" target="_blank" rel="noopener noreferrer"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/50 text-muted-foreground transition-all hover:border-foreground/50 hover:text-foreground">
                <Github className="h-4 w-4" />
              </a>
              <a href="mailto:eric@example.com"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/50 text-muted-foreground transition-all hover:border-foreground/50 hover:text-foreground">
                <Mail className="h-4 w-4" />
              </a>
            </div>
          </div>
        </motion.div>

        {/* Bottom */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-border/40 pt-6 sm:flex-row">
          <p className="text-sm text-muted-foreground">
&copy; {new Date().getFullYear()} Eric Blog. 保留所有权利.
          </p>
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            由 Eric 精心制作 <Heart className="h-3.5 w-3.5 fill-foreground text-foreground" />
          </p>
        </motion.div>
      </div>
    </footer>
  )
}
