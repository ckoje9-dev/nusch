'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { AuthProvider, useAuth } from '@/lib/firebase/auth-context'
import { Button } from '@/components/ui/button'
import {
  Calendar,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  ClipboardList,
  RefreshCcw,
  Palmtree,
  CheckSquare,
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { user, userData, loading, signOut } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  const isAdmin = userData?.role === 'admin'

  const adminNavItems = [
    { href: '/admin/schedule', icon: Calendar, label: '근무표' },
    { href: '/admin/staff', icon: Users, label: '근무자 관리' },
    { href: '/admin/approvals', icon: CheckSquare, label: '결재함' },
    { href: '/admin/settings', icon: Settings, label: '설정' },
  ]

  const nurseNavItems = [
    { href: '/nurse/schedule', icon: Calendar, label: '내 근무표' },
    { href: '/nurse/swap', icon: RefreshCcw, label: '근무 교환' },
    { href: '/nurse/vacation', icon: Palmtree, label: '휴가 신청' },
  ]

  const navItems = isAdmin ? adminNavItems : nurseNavItems

  const handleSignOut = async () => {
    await signOut()
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-6 w-6 text-blue-600" />
          <span className="text-xl font-bold text-blue-600">NuSch</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </Button>
      </header>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 h-full w-64 bg-white border-r z-40 transform transition-transform duration-200 lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="p-4 border-b hidden lg:flex items-center gap-2">
          <Calendar className="h-8 w-8 text-blue-600" />
          <span className="text-2xl font-bold text-blue-600">NuSch</span>
        </div>

        <div className="p-4 border-b mt-16 lg:mt-0">
          <p className="text-sm text-gray-500">
            {isAdmin ? '관리자' : '간호사'}
          </p>
          <p className="font-semibold truncate">{userData?.name}</p>
        </div>

        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                  isActive
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-600 hover:bg-gray-100'
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t">
          <Button
            variant="ghost"
            className="w-full justify-start text-gray-600"
            onClick={handleSignOut}
          >
            <LogOut className="h-5 w-5 mr-3" />
            로그아웃
          </Button>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <main className="lg:ml-64 pt-16 lg:pt-0 min-h-screen">
        <div className="p-4 lg:p-8">{children}</div>
      </main>
    </div>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthProvider>
      <DashboardContent>{children}</DashboardContent>
    </AuthProvider>
  )
}
