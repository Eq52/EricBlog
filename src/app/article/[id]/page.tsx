'use client'

import { use } from 'react'
import Navbar from '@/components/blog/Navbar'
import Footer from '@/components/blog/Footer'
import ArticleView from '@/components/blog/ArticleView'

export default function ArticlePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="h-16" />
      <main className="flex-1">
        <ArticleView articleId={id} />
      </main>
      <Footer />
    </div>
  )
}
