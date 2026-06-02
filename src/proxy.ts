import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function proxy(request: NextRequest) {
  // Only protect /api/* routes
  if (!request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Skip health check
  if (request.nextUrl.pathname === '/api') {
    return NextResponse.next()
  }

  // Read allowed domains from database
  let allowedDomains: string[] = []
  try {
    const setting = await db.siteSetting.findUnique({
      where: { key: 'allowed_domains' },
    })
    if (setting?.value) {
      try {
        allowedDomains = JSON.parse(setting.value) as string[]
      } catch {
        allowedDomains = []
      }
    }
  } catch {
    // Database not available yet (first run), allow all
    return NextResponse.next()
  }

  // If no allowed domains configured, allow all requests
  // Admin needs to set this up first
  if (allowedDomains.length === 0) {
    return NextResponse.next()
  }

  const host = request.headers.get('host') || ''
  const origin = request.headers.get('origin') || ''
  const referer = request.headers.get('referer') || ''

  // Helper: extract hostname from a URL or host string
  const extractHostname = (urlOrHost: string): string => {
    try {
      const url = new URL(urlOrHost.startsWith('http') ? urlOrHost : `https://${urlOrHost}`)
      return url.hostname
    } catch {
      return urlOrHost.split(':')[0] // fallback: strip port
    }
  }

  // Collect all hostnames from the request
  const requestHostnames: string[] = []

  if (host) requestHostnames.push(extractHostname(host))
  if (origin) requestHostnames.push(extractHostname(origin))
  if (referer) requestHostnames.push(extractHostname(referer))

  // If no hostname could be extracted, block the request
  // (e.g., server-to-server, curl, etc.) — must have identifiable origin
  if (requestHostnames.length === 0) {
    return NextResponse.json(
      { error: 'Forbidden: Origin required' },
      { status: 403 }
    )
  }

  // Normalize allowed domains: extract hostnames
  const normalizedAllowed = allowedDomains.map((d) => {
    const trimmed = d.trim().toLowerCase()
    // Remove protocol prefix if present
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      try {
        return new URL(trimmed).hostname
      } catch {
        return trimmed
      }
    }
    // Remove port if present
    return trimmed.split(':')[0]
  })

  // Check if any request hostname exactly matches any allowed domain (no wildcard subdomain matching)
  const isAllowed = requestHostnames.some((h) =>
    normalizedAllowed.some((allowed) => h.toLowerCase() === allowed)
  )

  if (isAllowed) {
    return NextResponse.next()
  }

  return NextResponse.json(
    { error: 'Forbidden: Domain not allowed' },
    { status: 403 }
  )
}

export const config = {
  matcher: ['/api/:path*'],
}
