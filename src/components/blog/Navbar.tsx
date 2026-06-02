'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Menu,
  Home,
  User,
  LogOut,
  ShieldCheck,
  LogIn,
  ImageIcon,
  UserCircle,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { useAppStore } from '@/store'
import LogoIcon from '@/components/blog/LogoIcon'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'

export default function Navbar() {
  const { currentView, user, token, navigate, searchQuery, setSearchQuery, logout } =
    useAppStore()
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  // ---- Scroll-aware state + Claudia Topic Bar ----
  const [isScrolled, setIsScrolled] = useState(false)
  const [isHidden, setIsHidden] = useState(false)
  const [topicText, setTopicText] = useState<string | null>(null)
  const lastScrollY = useRef(0)
  const ticking = useRef(false)

  // Avoid hydration mismatch for theme toggle
  useEffect(() => setMounted(true), [])

  // Determine topic text based on current page
  const getTopicText = useCallback(() => {
    if (pathname.startsWith('/article/')) return '📖 文章详情'
    if (pathname === '/gallery') return '🖼️ 画廊'
    if (pathname === '/about') return '👤 关于'
    return null
  }, [pathname])

  const handleScroll = useCallback(() => {
    if (ticking.current) return
    ticking.current = true

    requestAnimationFrame(() => {
      const currentScrollY = window.scrollY

      setIsScrolled(currentScrollY > 50)

      if (currentScrollY > 300) {
        setIsHidden(currentScrollY > lastScrollY.current)
      } else {
        setIsHidden(false)
      }

      // Claudia Topic Bar: show "back to top" after scrolling far, or page topic
      const topic = getTopicText()
      if (topic) {
        if (currentScrollY > window.innerHeight * 2) {
          setTopicText('⬆ 回到顶部')
        } else if (currentScrollY > 50) {
          setTopicText(topic)
        } else {
          setTopicText(null)
        }
      } else {
        setTopicText(null)
      }

      lastScrollY.current = currentScrollY
      ticking.current = false
    })
  }, [getTopicText])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  const navLinks = [
    { label: '首页', view: 'home', icon: Home, href: '/' },
    { label: '画廊', view: 'gallery', icon: ImageIcon, href: '/gallery' },
    { label: '关于', view: 'about', icon: UserCircle, href: '/about' },
  ]

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    navigate('home')
    setMobileOpen(false)
  }

  const handleNavClick = (view: string) => {
    if (pathname !== '/') {
      navigate(view as any)
      router.push('/')
    } else {
      navigate(view as any)
    }
    setMobileOpen(false)
  }

  const handleNavLink = (link: typeof navLinks[number]) => {
    if (link.href === '/') {
      if (pathname !== '/') {
        router.push('/')
      }
      navigate('home')
    } else {
      router.push(link.href)
    }
    setMobileOpen(false)
  }

  useEffect(() => {
    if (searchOpen && searchRef.current) {
      searchRef.current.focus()
    }
  }, [searchOpen])

  // Theme icon helper
  const getThemeIcon = () => {
    if (!mounted) return <Sun className="h-5 w-5" />
    switch (theme) {
      case 'dark':
        return <Moon className="h-5 w-5" />
      case 'light':
        return <Sun className="h-5 w-5" />
      default:
        return <Monitor className="h-5 w-5" />
    }
  }

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className={cn(
        'fixed top-0 left-0 right-0 z-50 w-full transition-all duration-300 ease-in-out',
        // Scrolled state: solid background + shadow + border
        isScrolled
          ? 'border-b border-border/40 bg-background/80 shadow-lg shadow-black/[0.04] backdrop-blur-xl supports-[backdrop-filter]:bg-background/60'
          : 'border-b border-transparent bg-transparent',
        // Hidden on scroll down
        isHidden ? '-translate-y-full' : 'translate-y-0'
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Logo */}
        <button
          onClick={() => handleNavClick('home')}
          className="flex items-center gap-2 transition-opacity hover:opacity-80"
        >
          <LogoIcon className="h-8 w-8 rounded-lg" />
          <span className="text-lg font-bold tracking-tight">Eric Blog</span>
        </button>

        {/* Claudia-style Topic Bar (center) */}
        <div className="hidden flex-1 justify-center md:flex">
          <AnimatePresence>
            {topicText && isScrolled && (
              <motion.button
                key={topicText}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.25 }}
                onClick={topicText === '⬆ 回到顶部' ? scrollToTop : undefined}
                className={cn(
                  'text-sm font-medium text-muted-foreground/70 hover:text-foreground transition-colors truncate max-w-[200px]',
                  topicText === '⬆ 回到顶部' ? 'cursor-pointer' : 'cursor-default'
                )}
              >
                {topicText}
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => {
            const isActive = link.href === '/' ? (pathname === '/' && currentView === 'home') : pathname.startsWith(link.href)
            return (
              <button
                key={link.href}
                onClick={() => handleNavLink(link)}
                className={cn(
                  'relative inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                )}
              >
                <link.icon className="h-4 w-4" />
                {link.label}
                {isActive && (
                  <motion.div
                    layoutId="navbar-indicator"
                    className="absolute inset-x-0 -bottom-[1px] h-0.5 rounded-full bg-foreground"
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
              </button>
            )
          })}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Desktop Search */}
          <div className="hidden md:block">
            <form onSubmit={handleSearch} className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchRef}
                type="search"
                placeholder="搜索文章..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(
                  'rounded-full border-border/50 bg-muted/50 pl-9 transition-all duration-300',
                  isScrolled ? 'w-48 focus-visible:w-64 focus-visible:bg-background lg:w-56' : 'w-40 focus-visible:w-56 lg:w-48'
                )}
              />
            </form>
          </div>

          {/* Mobile Search Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setSearchOpen(!searchOpen)}
          >
            <Search className="h-5 w-5" />
          </Button>

          {/* Theme Toggle Dropdown - 3 modes */}
          {mounted && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  title="切换主题"
                  className="transition-colors"
                >
                  {getThemeIcon()}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36">
                <DropdownMenuItem
                  onClick={() => setTheme('light')}
                  className={cn(
                    'cursor-pointer gap-2',
                    theme === 'light' && 'bg-muted font-medium'
                  )}
                >
                  <Sun className="h-4 w-4" />
                  浅色
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setTheme('dark')}
                  className={cn(
                    'cursor-pointer gap-2',
                    theme === 'dark' && 'bg-muted font-medium'
                  )}
                >
                  <Moon className="h-4 w-4" />
                  深色
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setTheme('system')}
                  className={cn(
                    'cursor-pointer gap-2',
                    theme === 'system' && 'bg-muted font-medium'
                  )}
                >
                  <Monitor className="h-4 w-4" />
                  跟随系统
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Auth */}
          {user && token ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-muted text-foreground text-xs font-semibold">
                      {user.name?.slice(0, 2).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{user.name}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleNavClick('profile')}>
                  <User className="mr-2 h-4 w-4" />
                  个人中心
                </DropdownMenuItem>
                {user.role === 'admin' && (
                  <DropdownMenuItem onClick={() => handleNavClick('admin')}>
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    管理后台
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    logout()
                    handleNavClick('home')
                  }}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="hidden items-center gap-2 md:flex">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleNavClick('login')}
                className="font-medium"
              >
                <LogIn className="mr-1.5 h-4 w-4" />
                登录
              </Button>
            </div>
          )}

          {/* Mobile Menu */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <LogoIcon className="h-7 w-7 rounded-lg" />
                  Eric Blog
                </SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-2">
                <form onSubmit={handleSearch} className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder="搜索文章..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </form>
                {navLinks.map((link) => {
                  const isActive = link.href === '/' ? (pathname === '/' && currentView === 'home') : pathname.startsWith(link.href)
                  return (
                    <Button
                      key={link.href}
                      variant="ghost"
                      onClick={() => handleNavLink(link)}
                      className={`w-full justify-start gap-3 rounded-xl ${
                        isActive ? 'bg-muted text-foreground font-medium' : ''
                      }`}
                    >
                      <link.icon className="h-4 w-4" />
                      {link.label}
                    </Button>
                  )
                })}
                {/* Theme Toggle - Mobile (dropdown) */}
                {mounted && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        className="w-full justify-start gap-3 rounded-xl"
                      >
                        {getThemeIcon()}
                        {theme === 'dark' ? '深色模式' : theme === 'light' ? '浅色模式' : '跟随系统'}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-36">
                      <DropdownMenuItem onClick={() => setTheme('light')} className={cn('gap-2', theme === 'light' && 'bg-muted font-medium')}>
                        <Sun className="h-4 w-4" /> 浅色
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setTheme('dark')} className={cn('gap-2', theme === 'dark' && 'bg-muted font-medium')}>
                        <Moon className="h-4 w-4" /> 深色
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setTheme('system')} className={cn('gap-2', theme === 'system' && 'bg-muted font-medium')}>
                        <Monitor className="h-4 w-4" /> 跟随系统
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                {user && token ? (
                  <>
                    <div className="my-3 border-t" />
                    <Button variant="ghost" className="w-full justify-start gap-3 rounded-xl" onClick={() => handleNavClick('profile')}>
                      <User className="h-4 w-4" />
                      个人中心
                    </Button>
                    {user.role === 'admin' && (
                      <Button variant="ghost" className="w-full justify-start gap-3 rounded-xl" onClick={() => handleNavClick('admin')}>
                        <ShieldCheck className="h-4 w-4" />
                        管理后台
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-3 text-destructive hover:text-destructive rounded-xl"
                      onClick={() => { logout(); handleNavClick('home') }}
                    >
                      <LogOut className="h-4 w-4" />
                      退出登录
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="my-3 border-t" />
                    <Button variant="outline" className="w-full justify-start gap-3 rounded-xl" onClick={() => handleNavClick('login')}>
                      <LogIn className="h-4 w-4" />
                      登录
                    </Button>
                  </>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Mobile Search Bar */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-border/40 md:hidden"
          >
            <form onSubmit={handleSearch} className="p-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="搜索文章..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  autoFocus
                />
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  )
}
