'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/lib/firebase/auth-context'
import {
  getScheduleByMonth,
  getUsersByOrganization,
  getOrganization,
  createSwapRequest,
  getSwapRequestsByUser,
  getSwapRequestsForUser,
  updateSwapRequest,
} from '@/lib/firebase/firestore'
import { validateSwapRequest } from '@/lib/scheduler/validator'
import { useToast } from '@/hooks/use-toast'
import { Loader2, RefreshCcw, Send, Check, X, Clock } from 'lucide-react'
import { cn, getDaysInMonth, formatDate } from '@/lib/utils'
import type { Schedule, User, ShiftType, SwapRequest, Organization } from '@/types'

const SHIFT_LABELS: Record<ShiftType, string> = {
  day: 'Day',
  evening: 'Evening',
  night: 'Night',
  charge: 'Charge',
  off: 'Off',
}

export default function SwapPage() {
  const { userData } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [colleagues, setColleagues] = useState<User[]>([])
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [myRequests, setMyRequests] = useState<SwapRequest[]>([])
  const [incomingRequests, setIncomingRequests] = useState<SwapRequest[]>([])

  // Form state
  const [myShiftDate, setMyShiftDate] = useState('')
  const [targetUserId, setTargetUserId] = useState('')
  const [targetShiftDate, setTargetShiftDate] = useState('')

  const currentMonth = (() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })()

  const loadData = async () => {
    if (!userData?.organizationId) return

    setLoading(true)
    try {
      const [existingSchedule, users, org, sent, received] = await Promise.all([
        getScheduleByMonth(userData.organizationId, currentMonth),
        getUsersByOrganization(userData.organizationId),
        getOrganization(userData.organizationId),
        getSwapRequestsByUser(userData.id),
        getSwapRequestsForUser(userData.id),
      ])

      setSchedule(existingSchedule)
      setColleagues(users.filter((u) => u.role === 'nurse' && u.id !== userData.id))
      setOrganization(org)
      setMyRequests(sent)
      setIncomingRequests(received)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [userData?.organizationId])

  const getMyShifts = () => {
    if (!schedule || !userData) return []

    const shifts: { date: string; type: ShiftType }[] = []
    const [year, month] = currentMonth.split('-').map(Number)
    const days = getDaysInMonth(year, month - 1)

    days.forEach((date) => {
      const dateStr = formatDate(date)
      const assignment = schedule.assignments[dateStr]
      if (!assignment) return

      for (const type of ['day', 'evening', 'night', 'charge'] as ShiftType[]) {
        if (assignment[type]?.includes(userData.id)) {
          shifts.push({ date: dateStr, type })
        }
      }
    })

    return shifts
  }

  const getTargetShifts = () => {
    if (!schedule || !targetUserId) return []

    const shifts: { date: string; type: ShiftType }[] = []
    const [year, month] = currentMonth.split('-').map(Number)
    const days = getDaysInMonth(year, month - 1)

    days.forEach((date) => {
      const dateStr = formatDate(date)
      const assignment = schedule.assignments[dateStr]
      if (!assignment) return

      for (const type of ['day', 'evening', 'night', 'charge'] as ShiftType[]) {
        if (assignment[type]?.includes(targetUserId)) {
          shifts.push({ date: dateStr, type })
        }
      }
    })

    return shifts
  }

  const handleSubmit = async () => {
    if (!userData || !schedule || !organization || !myShiftDate || !targetUserId || !targetShiftDate) {
      toast({
        title: '입력 오류',
        description: '모든 항목을 선택해주세요.',
        variant: 'destructive',
      })
      return
    }

    const myShift = getMyShifts().find((s) => s.date === myShiftDate)
    const targetShift = getTargetShifts().find((s) => s.date === targetShiftDate)
    const target = colleagues.find((c) => c.id === targetUserId)

    if (!myShift || !targetShift || !target) return

    setSubmitting(true)
    try {
      // Validate the swap
      const [year, month] = currentMonth.split('-').map(Number)
      const allDays = getDaysInMonth(year, month - 1)

      const validation = validateSwapRequest(
        userData as User,
        target,
        myShift,
        targetShift,
        schedule.assignments,
        organization.settings,
        allDays
      )

      const request: Omit<SwapRequest, 'id'> = {
        organizationId: userData.organizationId,
        requesterId: userData.id,
        targetId: targetUserId,
        requesterShift: myShift,
        targetShift: targetShift,
        status: validation.requiresAdminApproval ? 'admin_review' : 'pending',
        requiresAdminApproval: validation.requiresAdminApproval,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      await createSwapRequest(request)

      toast({
        title: '요청 완료',
        description: validation.requiresAdminApproval
          ? '규칙 위반으로 관리자 승인이 필요합니다.'
          : `${target.name}님에게 교환 요청을 보냈습니다.`,
      })

      // Reset form
      setMyShiftDate('')
      setTargetUserId('')
      setTargetShiftDate('')
      loadData()
    } catch (error) {
      toast({
        title: '요청 실패',
        description: '다시 시도해주세요.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleIncomingRequest = async (request: SwapRequest, approved: boolean) => {
    try {
      await updateSwapRequest(request.id, approved ? 'approved' : 'rejected')
      toast({
        title: approved ? '승인 완료' : '거절 완료',
        description: `근무 교환이 ${approved ? '승인' : '거절'}되었습니다.`,
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

  const myShifts = getMyShifts()
  const targetShifts = getTargetShifts()

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">근무 교환</h1>
        <p className="text-gray-500">동료와 근무를 교환할 수 있습니다.</p>
      </div>

      {/* Request Form */}
      <Card>
        <CardHeader>
          <CardTitle>교환 요청하기</CardTitle>
          <CardDescription>
            내 근무와 교환할 동료의 근무를 선택하세요.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>내 근무 선택</Label>
            <Select value={myShiftDate} onValueChange={setMyShiftDate}>
              <SelectTrigger>
                <SelectValue placeholder="교환할 내 근무를 선택" />
              </SelectTrigger>
              <SelectContent>
                {myShifts.map((shift) => (
                  <SelectItem key={shift.date} value={shift.date}>
                    {shift.date} - {SHIFT_LABELS[shift.type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>교환할 동료</Label>
            <Select value={targetUserId} onValueChange={setTargetUserId}>
              <SelectTrigger>
                <SelectValue placeholder="동료를 선택" />
              </SelectTrigger>
              <SelectContent>
                {colleagues.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {targetUserId && (
            <div className="space-y-2">
              <Label>동료 근무 선택</Label>
              <Select value={targetShiftDate} onValueChange={setTargetShiftDate}>
                <SelectTrigger>
                  <SelectValue placeholder="교환받을 근무를 선택" />
                </SelectTrigger>
                <SelectContent>
                  {targetShifts.map((shift) => (
                    <SelectItem key={shift.date} value={shift.date}>
                      {shift.date} - {SHIFT_LABELS[shift.type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={submitting || !myShiftDate || !targetUserId || !targetShiftDate}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            교환 요청
          </Button>
        </CardContent>
      </Card>

      {/* Incoming Requests */}
      {incomingRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-500" />
              받은 요청
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {incomingRequests.map((request) => {
              const requester = colleagues.find((c) => c.id === request.requesterId)

              return (
                <div
                  key={request.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-semibold">{requester?.name || '알 수 없음'}</p>
                    <p className="text-sm text-gray-500">
                      {request.requesterShift.date} {SHIFT_LABELS[request.requesterShift.type]} ↔{' '}
                      {request.targetShift.date} {SHIFT_LABELS[request.targetShift.type]}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleIncomingRequest(request, false)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleIncomingRequest(request, true)}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* My Requests */}
      {myRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>보낸 요청</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {myRequests.map((request) => {
              const target = colleagues.find((c) => c.id === request.targetId)

              return (
                <div
                  key={request.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-semibold">{target?.name || '알 수 없음'}</p>
                    <p className="text-sm text-gray-500">
                      {request.requesterShift.date} ↔ {request.targetShift.date}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'px-2 py-1 rounded text-sm',
                      request.status === 'pending' && 'bg-yellow-100 text-yellow-700',
                      request.status === 'admin_review' && 'bg-blue-100 text-blue-700',
                      request.status === 'approved' && 'bg-green-100 text-green-700',
                      request.status === 'rejected' && 'bg-red-100 text-red-700'
                    )}
                  >
                    {request.status === 'pending' && '대기중'}
                    {request.status === 'admin_review' && '관리자 검토중'}
                    {request.status === 'approved' && '승인됨'}
                    {request.status === 'rejected' && '거절됨'}
                  </span>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
