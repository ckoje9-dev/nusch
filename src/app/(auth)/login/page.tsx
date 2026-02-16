'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar, Loader2 } from 'lucide-react'
import { getDoc, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { useAuth } from '@/lib/firebase/auth-context'
import { useToast } from '@/hooks/use-toast'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { signIn } = useAuth()
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      await signIn(email, password)

      // Fetch user role to route correctly
      const { getAuth } = await import('firebase/auth')
      const currentUser = getAuth().currentUser
      if (currentUser && db) {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid))
        const role = userDoc.exists() ? userDoc.data().role : 'admin'
        toast({
          title: '로그인 성공',
          description: '환영합니다!',
        })
        router.push(role === 'nurse' ? '/nurse/schedule' : '/admin/schedule')
      } else {
        router.push('/admin/schedule')
      }
    } catch (error: any) {
      toast({
        title: '로그인 실패',
        description: error.message || '이메일 또는 비밀번호를 확인해주세요.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Link href="/" className="flex items-center justify-center gap-2 mb-4">
            <Calendar className="h-8 w-8 text-blue-600" />
            <span className="text-2xl font-bold text-blue-600">NuSch</span>
          </Link>
          <CardTitle className="text-2xl">로그인</CardTitle>
          <CardDescription>계정 정보를 입력해주세요</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">이메일</Label>
              <Input
                id="email"
                type="email"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">비밀번호</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              로그인
            </Button>
            <p className="text-sm text-gray-500 text-center">
              계정이 없으신가요?{' '}
              <Link href="/register" className="text-blue-600 hover:underline">
                회원가입
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
