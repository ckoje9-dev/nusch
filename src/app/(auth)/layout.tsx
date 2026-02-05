'use client'

import { AuthProvider } from '@/lib/firebase/auth-context'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AuthProvider>{children}</AuthProvider>
}
