'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/lib/firebase/auth-context'
import {
  getPendingAdminSwapRequests,
  getPendingVacationRequests,
  updateSwapRequest,
  updateVacationRequest,
  updateUser,
  getUser,
} from '@/lib/firebase/firestore'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Check, X, RefreshCcw, Palmtree } from 'lucide-react'
import type { SwapRequest, VacationRequest, User } from '@/types'

export default function ApprovalsPage() {
  const { userData } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [swapRequests, setSwapRequests] = useState<SwapRequest[]>([])
  const [vacationRequests, setVacationRequests] = useState<VacationRequest[]>([])
  const [users, setUsers] = useState<Map<string, User>>(new Map())

  const loadData = async () => {
    if (!userData?.organizationId) return

    setLoading(true)
    try {
      const [swaps, vacations] = await Promise.all([
        getPendingAdminSwapRequests(userData.organizationId),
        getPendingVacationRequests(userData.organizationId),
      ])

      setSwapRequests(swaps)
      setVacationRequests(vacations)

      // Load user info
      const userIds = new Set<string>()
      swaps.forEach((s) => {
        userIds.add(s.requesterId)
        userIds.add(s.targetId)
      })
      vacations.forEach((v) => userIds.add(v.userId))

      const userMap = new Map<string, User>()
      await Promise.all(
        Array.from(userIds).map(async (id) => {
          const user = await getUser(id)
          if (user) userMap.set(id, user)
        })
      )
      setUsers(userMap)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [userData?.organizationId])

  const handleSwapApproval = async (requestId: string, approved: boolean) => {
    try {
      await updateSwapRequest(requestId, approved ? 'approved' : 'rejected')
      toast({
        title: approved ? '승인 완료' : '거절 완료',
        description: `근무 교환 요청이 ${approved ? '승인' : '거절'}되었습니다.`,
      })
      loadData()
    } catch (error) {
      toast({
        title: '처리 실패',
        description: '다시 시도해주세요.',
        variant: 'destructive',
      })
    }
  }

  const handleVacationApproval = async (
    request: VacationRequest,
    approved: boolean
  ) => {
    try {
      await updateVacationRequest(request.id, approved ? 'approved' : 'rejected')

      // If approved, update user's vacation dates
      if (approved) {
        const user = users.get(request.userId)
        if (user) {
          const newVacationDates = [
            ...new Set([...user.personalRules.vacationDates, ...request.dates]),
          ]
          await updateUser(request.userId, {
            personalRules: {
              ...user.personalRules,
              vacationDates: newVacationDates,
            },
          })
        }
      }

      toast({
        title: approved ? '승인 완료' : '거절 완료',
        description: `휴가 요청이 ${approved ? '승인' : '거절'}되었습니다.`,
      })
      loadData()
    } catch (error) {
      toast({
        title: '처리 실패',
        description: '다시 시도해주세요.',
        variant: 'destructive',
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  const totalPending = swapRequests.length + vacationRequests.length

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">결재함</h1>
        <p className="text-gray-500">
          {totalPending > 0
            ? `${totalPending}건의 요청이 대기중입니다.`
            : '대기 중인 요청이 없습니다.'}
        </p>
      </div>

      <Tabs defaultValue="swap">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="swap" className="flex items-center gap-2">
            <RefreshCcw className="h-4 w-4" />
            근무 교환 ({swapRequests.length})
          </TabsTrigger>
          <TabsTrigger value="vacation" className="flex items-center gap-2">
            <Palmtree className="h-4 w-4" />
            휴가 신청 ({vacationRequests.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="swap">
          {swapRequests.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <RefreshCcw className="h-12 w-12 text-gray-300 mb-4" />
                <p className="text-gray-500">대기 중인 근무 교환 요청이 없습니다.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {swapRequests.map((request) => {
                const requester = users.get(request.requesterId)
                const target = users.get(request.targetId)

                return (
                  <Card key={request.id}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">근무 교환 요청</CardTitle>
                      <CardDescription>
                        {new Date(request.createdAt).toLocaleDateString('ko-KR')} 요청
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
                        <div className="flex-1 p-3 bg-gray-50 rounded-lg">
                          <p className="font-semibold">{requester?.name}</p>
                          <p className="text-sm text-gray-500">
                            {request.requesterShift.date} {request.requesterShift.type.toUpperCase()}
                          </p>
                        </div>
                        <RefreshCcw className="h-5 w-5 text-gray-400 mx-auto" />
                        <div className="flex-1 p-3 bg-gray-50 rounded-lg">
                          <p className="font-semibold">{target?.name}</p>
                          <p className="text-sm text-gray-500">
                            {request.targetShift.date} {request.targetShift.type.toUpperCase()}
                          </p>
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          onClick={() => handleSwapApproval(request.id, false)}
                        >
                          <X className="h-4 w-4 mr-2" />
                          거절
                        </Button>
                        <Button onClick={() => handleSwapApproval(request.id, true)}>
                          <Check className="h-4 w-4 mr-2" />
                          승인
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="vacation">
          {vacationRequests.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Palmtree className="h-12 w-12 text-gray-300 mb-4" />
                <p className="text-gray-500">대기 중인 휴가 요청이 없습니다.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {vacationRequests.map((request) => {
                const user = users.get(request.userId)

                return (
                  <Card key={request.id}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">휴가 신청</CardTitle>
                      <CardDescription>
                        {user?.name} · {new Date(request.createdAt).toLocaleDateString('ko-KR')} 요청
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="mb-4">
                        <p className="text-sm text-gray-500 mb-2">신청 날짜:</p>
                        <div className="flex flex-wrap gap-2">
                          {request.dates.map((date) => (
                            <span
                              key={date}
                              className="px-2 py-1 bg-green-100 text-green-700 rounded text-sm"
                            >
                              {date}
                            </span>
                          ))}
                        </div>
                        {request.reason && (
                          <p className="mt-2 text-sm text-gray-600">
                            사유: {request.reason}
                          </p>
                        )}
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          onClick={() => handleVacationApproval(request, false)}
                        >
                          <X className="h-4 w-4 mr-2" />
                          거절
                        </Button>
                        <Button onClick={() => handleVacationApproval(request, true)}>
                          <Check className="h-4 w-4 mr-2" />
                          승인
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
