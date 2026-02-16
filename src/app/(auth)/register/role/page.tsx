'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar, Loader2, Shield, Stethoscope } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { createOrganization } from '@/lib/firebase/firestore'
import { doc, setDoc, updateDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase/config'
import { cn } from '@/lib/utils'
import type { OrganizationSettings, User, UserRole } from '@/types'

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

export default function RoleSelectionPage() {
  const [step, setStep] = useState<'role' | 'org'>('role')
  const [orgName, setOrgName] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  const currentUser = auth?.currentUser
  if (!currentUser) {
    router.push('/login')
    return null
  }

  const handleRoleSelect = async (role: UserRole) => {
    if (role === 'nurse') {
      setLoading(true)
      try {
        if (!db) throw new Error('Firebase not initialized')
        const newUser: User = {
          id: currentUser.uid,
          organizationId: '',
          email: currentUser.email || '',
          name: currentUser.displayName || '',
          role: 'nurse',
          yearsOfExperience: 1,
          personalRules: {
            vacationDates: [],
            selectedShiftsOnly: null,
            dedicatedRole: null,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        await setDoc(doc(db, 'users', currentUser.uid), newUser)
        toast({
          title: '가입 완료',
          description: '간호사 계정이 생성되었습니다.',
        })
        router.push('/nurse/schedule')
      } catch (error: any) {
        toast({
          title: '오류',
          description: error.message || '다시 시도해주세요.',
          variant: 'destructive',
        })
      } finally {
        setLoading(false)
      }
      return
    }

    // Admin: need org name
    setStep('org')
  }

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (!db) throw new Error('Firebase not initialized')

      const newUser: User = {
        id: currentUser.uid,
        organizationId: '',
        email: currentUser.email || '',
        name: currentUser.displayName || '',
        role: 'admin',
        yearsOfExperience: 1,
        personalRules: {
          vacationDates: [],
          selectedShiftsOnly: null,
          dedicatedRole: null,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      await setDoc(doc(db, 'users', currentUser.uid), newUser)

      const orgId = await createOrganization(orgName, currentUser.uid, DEFAULT_SETTINGS)
      await updateDoc(doc(db, 'users', currentUser.uid), {
        organizationId: orgId,
      })

      toast({
        title: '가입 완료',
        description: '관리자 계정이 생성되었습니다.',
      })
      router.push('/admin/settings')
    } catch (error: any) {
      toast({
        title: '오류',
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
          <CardTitle className="text-2xl">
            {step === 'role' ? '가입 유형 선택' : '병원/부서 정보'}
          </CardTitle>
          <CardDescription>
            {step === 'role'
              ? `${currentUser.displayName || currentUser.email}님, 가입 유형을 선택해주세요`
              : '병원/부서 정보를 입력해주세요'}
          </CardDescription>
        </CardHeader>

        {step === 'role' ? (
          <CardContent className="space-y-3">
            <button
              type="button"
              onClick={() => handleRoleSelect('admin')}
              disabled={loading}
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
              onClick={() => handleRoleSelect('nurse')}
              disabled={loading}
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
            {loading && (
              <div className="flex justify-center py-2">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              </div>
            )}
          </CardContent>
        ) : (
          <form onSubmit={handleCreateOrg}>
            <CardContent className="space-y-4">
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
                  가입 후 근무 규칙을 상세히 설정할 수 있습니다.
                  기본값으로 시작하고 나중에 수정하세요.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep('role')}
                >
                  이전
                </Button>
                <Button type="submit" className="flex-1" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  가입하기
                </Button>
              </div>
            </CardContent>
          </form>
        )}
      </Card>
    </div>
  )
}
