'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar, Loader2, Shield, Stethoscope } from 'lucide-react'
import { useAuth } from '@/lib/firebase/auth-context'
import { useToast } from '@/hooks/use-toast'
import { createOrganization } from '@/lib/firebase/firestore'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { cn } from '@/lib/utils'
import type { OrganizationSettings, UserRole } from '@/types'

const DEFAULT_SETTINGS: OrganizationSettings = {
  simultaneousStaff: { day: 3, evening: 3, night: 2 },
  maxConsecutiveWorkDays: 5,
  maxConsecutiveNightDays: 3,
  monthlyOffDays: 8,
  chargeSettings: {
    intensityWeight: 1.2,
    minYearsRequired: 3,
  },
  prohibitNOD: true,
  prohibitEOD: false,
}

export default function RegisterPage() {
  const [step, setStep] = useState(1)
  const [role, setRole] = useState<UserRole | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [name, setName] = useState('')
  const [orgName, setOrgName] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { signUp } = useAuth()
  const { toast } = useToast()

  // Step 1: 역할 선택
  // Step 2: 계정 정보 (이메일, 이름, 비밀번호)
  // Step 3: 병원 정보 (관리자만)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (step === 2) {
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

      if (role === 'nurse') {
        // 간호사는 바로 가입 처리
        setLoading(true)
        try {
          await signUp(email, password, name, 'nurse')
          toast({
            title: '회원가입 완료',
            description: '간호사 계정이 생성되었습니다.',
          })
          router.push('/nurse/schedule')
        } catch (error: any) {
          toast({
            title: '회원가입 실패',
            description: error.code === 'auth/email-already-in-use'
              ? '이미 사용 중인 이메일입니다.'
              : error.message || '다시 시도해주세요.',
            variant: 'destructive',
          })
        } finally {
          setLoading(false)
        }
        return
      }

      // 관리자는 다음 단계로
      setStep(3)
      return
    }

    // Step 3: 관리자 - 조직 생성
    setLoading(true)
    try {
      await signUp(email, password, name, 'admin')

      const { auth } = await import('@/lib/firebase/config')
      const userId = auth?.currentUser?.uid

      if (userId && db) {
        const orgId = await createOrganization(orgName, userId, DEFAULT_SETTINGS)
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
        description: error.code === 'auth/email-already-in-use'
          ? '이미 사용 중인 이메일입니다.'
          : error.message || '다시 시도해주세요.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const stepDescription = step === 1
    ? '가입 유형을 선택해주세요'
    : step === 2
    ? '계정 정보를 입력해주세요'
    : '병원/부서 정보를 입력해주세요'

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Link href="/" className="flex items-center justify-center gap-2 mb-4">
            <Calendar className="h-8 w-8 text-blue-600" />
            <span className="text-2xl font-bold text-blue-600">NuSch</span>
          </Link>
          <CardTitle className="text-2xl">회원가입</CardTitle>
          <CardDescription>{stepDescription}</CardDescription>
        </CardHeader>

        {step === 1 ? (
          <CardContent className="space-y-3">
            <button
              type="button"
              onClick={() => { setRole('admin'); setStep(2) }}
              className={cn(
                'w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-colors text-left',
                'hover:border-blue-400 hover:bg-blue-50/50'
              )}
            >
              <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <Shield className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold">관리자 (수간호사)</p>
                <p className="text-sm text-gray-500">근무표를 생성하고 간호사를 관리합니다</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => { setRole('nurse'); setStep(2) }}
              className={cn(
                'w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-colors text-left',
                'hover:border-green-400 hover:bg-green-50/50'
              )}
            >
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                <Stethoscope className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="font-semibold">간호사</p>
                <p className="text-sm text-gray-500">내 근무표를 확인하고 교환/휴가를 신청합니다</p>
              </div>
            </button>
            <div className="pt-2">
              <p className="text-sm text-gray-500 text-center">
                이미 계정이 있으신가요?{' '}
                <Link href="/login" className="text-blue-600 hover:underline">
                  로그인
                </Link>
              </p>
            </div>
          </CardContent>
        ) : (
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {step === 2 ? (
                <>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 text-sm">
                    {role === 'admin' ? (
                      <Shield className="h-4 w-4 text-blue-600" />
                    ) : (
                      <Stethoscope className="h-4 w-4 text-green-600" />
                    )}
                    <span className="text-gray-600">
                      {role === 'admin' ? '관리자' : '간호사'}로 가입
                    </span>
                  </div>
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
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep(step - 1)}
                >
                  이전
                </Button>
                <Button type="submit" className="flex-1" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {step === 2 && role === 'nurse' ? '가입하기' : step === 2 ? '다음' : '가입하기'}
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
        )}
      </Card>
    </div>
  )
}
