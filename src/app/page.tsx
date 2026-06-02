'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useAppStore } from '@/store'
import Navbar from '@/components/blog/Navbar'
import Footer from '@/components/blog/Footer'
import HomeView from '@/components/blog/HomeView'
import { LoginComponent } from '@/components/blog/AuthViews'
import ProfileView from '@/components/blog/ProfileView'
import AdminView from '@/components/admin/AdminView'
import ArticleEditor from '@/components/admin/ArticleEditor'

const viewComponents: Record<string, React.ComponentType> = {
  home: HomeView,
  login: LoginComponent,
  profile: ProfileView,
  admin: AdminView,
  'admin-editor': ArticleEditor,
}

export default function Home() {
  const currentView = useAppStore((s) => s.currentView)

  const ViewComponent = viewComponents[currentView] || HomeView

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      {/* Spacer for fixed navbar */}
      <div className="h-16" />
      <main className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentView}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
          >
            <ViewComponent />
          </motion.div>
        </AnimatePresence>
      </main>
      <Footer />
    </div>
  )
}
