'use client'

import { motion } from 'framer-motion'
import { Github } from 'lucide-react'
import Navbar from '@/components/blog/Navbar'
import Footer from '@/components/blog/Footer'

export default function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="h-16" />
      <main className="flex-1">
        <div className="mx-auto flex min-h-[calc(100vh-10rem)] max-w-2xl items-center justify-center px-4 py-20 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="w-full text-center"
          >
            {/* Avatar */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="mb-8 flex justify-center"
            >
              <img
                src="/avatar.jpg"
                alt="Eric"
                className="h-32 w-32 rounded-full border-2 border-foreground/10 object-cover shadow-lg sm:h-40 sm:w-40"
              />
            </motion.div>

            {/* Name */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mb-3 text-3xl font-bold tracking-tight sm:text-4xl"
            >
              Eric
            </motion.h1>

            {/* Bio */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="mb-8 text-muted-foreground"
            >
              记录技术、生活与创意
            </motion.p>

            {/* GitHub Link */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <a
                href="https://github.com/Eq52"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 rounded-full border border-border px-6 py-3 text-sm font-medium text-foreground transition-all hover:border-foreground/50 hover:shadow-md"
              >
                <Github className="h-5 w-5" />
                @Eq52
              </a>
            </motion.div>
          </motion.div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
