'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar, Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/firebase/auth-context'
import { useToast } from '@/hooks/use-toast'
import { createOrganization } from '@/lib/firebase/firestore'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import type { OrganizationSettings } from '@/types'

const DEFAULT_SETTINGS: OrganizationSettings = {
  simultaneousStaff: { day: 3, evening: 3, night: 2 },
  maxConsecutiveWorkDays: 5,
  maxConsecutiveNightDays: 3,
  monthlyOffDays: 8,
  minRestHours: 8,
  chargeSettings: {
    intensityWeight: 1.2,
    minYearsRequired: 3,
  },
  prohibitNOD: true,
  prohibitEOD: false,
}

export default function RegisterPage() {
  const [step, setStep] = useState(1)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [name, setName] = useState('')
  const [orgName, setOrgName] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { signUp } = useAuth()
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (step === 1) {
      if (password !== confirmPassword) {
        toast({
          title: '비밀번호 불일치',
          description: '비밀번호가 일치하지 않습니다.',
          variant: 'destructive',
        })
        return
      }
      if (password.length < 6) {
        toast({
          title: '비밀번호 오류',
          description: '비밀번호는 6자 이상이어야 합니다.',
          variant: 'destructive',
        })
        return
      }
      setStep(2)
      return
    }

    setLoading(true)

    try {
      // Create admin user
      await signUp(email, password, name, 'admin')

      // Get the created user's ID
      const { auth } = await import('@/lib/firebase/config')
      const userId = auth?.currentUser?.uid

      if (userId && db) {
        // Create organization
        const orgId = await createOrganization(orgName, userId, DEFAULT_SETTINGS)

        // Update user with organization ID
        await updateDoc(doc(db, 'users', userId), {
          organizationId: orgId,
        })
      }

      toast({
        title: '회원가입 완료',
        description: '관리자 계정이 생성되었습니다.',
      })

      router.push('/admin/settings')
    } catch (error: any) {
      toast({
        title: '회원가입 실패',
        description: error.message || '다시 시도해주세요.',
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
          <CardTitle className="text-2xl">관리자 회원가입</CardTitle>
          <CardDescription>
            {step === 1 ? '계정 정보를 입력해주세요' : '병원/부서 정보를 입력해주세요'}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {step === 1 ? (
              <>
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
                  <Label htmlFor="name">이름</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="홍길동"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">비밀번호</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="6자 이상"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">비밀번호 확인</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="비밀번호를 다시 입력"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="orgName">병원/부서 이름</Label>
                  <Input
                    id="orgName"
                    type="text"
                    placeholder="예: OO병원 내과병동"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    required
                  />
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">
                    회원가입 후 근무 규칙을 상세히 설정할 수 있습니다.
                    기본값으로 시작하고 나중에 수정하세요.
                  </p>
                </div>
              </>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <div className="flex gap-2 w-full">
              {step === 2 && (
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep(1)}
                >
                  이전
                </Button>
              )}
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {step === 1 ? '다음' : '가입하기'}
              </Button>
            </div>
            <p className="text-sm text-gray-500 text-center">
              이미 계정이 있으신가요?{' '}
              <Link href="/login" className="text-blue-600 hover:underline">
                로그인
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
