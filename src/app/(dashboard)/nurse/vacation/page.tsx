'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/lib/firebase/auth-context'
import {
  createVacationRequest,
  getVacationRequestsByUser,
} from '@/lib/firebase/firestore'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Palmtree, Plus, X, Send, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { VacationRequest } from '@/types'

export default function VacationPage() {
  const { userData } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [requests, setRequests] = useState<VacationRequest[]>([])

  // Form state
  const [selectedDates, setSelectedDates] = useState<string[]>([])
  const [reason, setReason] = useState('')

  // Get next month for vacation request
  const nextMonth = (() => {
    const now = new Date()
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`
  })()

  const loadData = async () => {
    if (!userData) return

    setLoading(true)
    try {
      const vacationRequests = await getVacationRequestsByUser(userData.id)
      setRequests(vacationRequests)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [userData?.id])

  const toggleDate = (dateStr: string) => {
    if (selectedDates.includes(dateStr)) {
      setSelectedDates(selectedDates.filter((d) => d !== dateStr))
    } else {
      setSelectedDates([...selectedDates, dateStr].sort())
    }
  }

  const handleSubmit = async () => {
    if (!userData || selectedDates.length === 0) {
      toast({
        title: '입력 오류',
        description: '휴가 날짜를 선택해주세요.',
        variant: 'destructive',
      })
      return
    }

    setSubmitting(true)
    try {
      await createVacationRequest({
        organizationId: userData.organizationId,
        userId: userData.id,
        dates: selectedDates,
        reason: reason || undefined,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      toast({
        title: '신청 완료',
        description: '휴가 신청이 접수되었습니다.',
      })

      setSelectedDates([])
      setReason('')
      loadData()
    } catch (error) {
      toast({
        title: '신청 실패',
        description: '다시 시도해주세요.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  // Generate calendar for next month
  const [year, month] = nextMonth.split('-').map(Number)
  const daysInMonth = new Date(year, month, 0).getDate()
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay()

  const calendarDays = Array.from({ length: daysInMonth }, (_, i) => {
    const date = new Date(year, month - 1, i + 1)
    return {
      day: i + 1,
      dateStr: `${year}-${String(month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`,
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
    }
  })

  // Existing approved vacation dates
  const approvedDates = userData?.personalRules.vacationDates || []

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">휴가 신청</h1>
        <p className="text-gray-500">다음 달 휴가를 미리 신청하세요.</p>
      </div>

      {/* Vacation Request Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {year}년 {month}월 휴가 신청
          </CardTitle>
          <CardDescription>
            휴가를 원하는 날짜를 클릭하세요. (복수 선택 가능)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Calendar */}
          <div className="mb-6">
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['일', '월', '화', '수', '목', '금', '토'].map((day, i) => (
                <div
                  key={day}
                  className={cn(
                    'text-center text-sm font-medium py-1',
                    i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-500'
                  )}
                >
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {/* Empty cells */}
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}

              {/* Days */}
              {calendarDays.map((d) => {
                const isSelected = selectedDates.includes(d.dateStr)
                const isApproved = approvedDates.includes(d.dateStr)

                return (
                  <button
                    key={d.dateStr}
                    onClick={() => !isApproved && toggleDate(d.dateStr)}
                    disabled={isApproved}
                    className={cn(
                      'aspect-square flex items-center justify-center rounded-lg text-sm transition-colors',
                      isApproved
                        ? 'bg-green-100 text-green-700 cursor-not-allowed'
                        : isSelected
                        ? 'bg-blue-500 text-white'
                        : d.isWeekend
                        ? 'bg-gray-100 hover:bg-gray-200'
                        : 'hover:bg-gray-100'
                    )}
                  >
                    {d.day}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Selected Dates */}
          {selectedDates.length > 0 && (
            <div className="mb-4">
              <Label className="text-sm text-gray-500">선택한 날짜:</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {selectedDates.map((date) => (
                  <span
                    key={date}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm"
                  >
                    {date}
                    <button onClick={() => toggleDate(date)}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Reason */}
          <div className="space-y-2 mb-4">
            <Label>사유 (선택)</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="휴가 사유를 입력하세요"
            />
          </div>

          {/* Submit */}
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={submitting || selectedDates.length === 0}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            휴가 신청
          </Button>

          {/* Legend */}
          <div className="flex justify-center gap-4 mt-4 text-sm">
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 bg-blue-500 rounded" />
              <span>선택됨</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 bg-green-100 rounded" />
              <span>승인됨</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Request History */}
      <Card>
        <CardHeader>
          <CardTitle>신청 내역</CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Palmtree className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>휴가 신청 내역이 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map((request) => (
                <div
                  key={request.id}
                  className="flex items-start justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div>
                    <div className="flex flex-wrap gap-1 mb-1">
                      {request.dates.map((date) => (
                        <span
                          key={date}
                          className="text-sm px-2 py-0.5 bg-white rounded border"
                        >
                          {date}
                        </span>
                      ))}
                    </div>
                    {request.reason && (
                      <p className="text-sm text-gray-500">{request.reason}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(request.createdAt).toLocaleDateString('ko-KR')} 신청
                    </p>
                  </div>
                  <span
                    className={cn(
                      'px-2 py-1 rounded text-sm whitespace-nowrap',
                      request.status === 'pending' && 'bg-yellow-100 text-yellow-700',
                      request.status === 'approved' && 'bg-green-100 text-green-700',
                      request.status === 'rejected' && 'bg-red-100 text-red-700'
                    )}
                  >
                    {request.status === 'pending' && '대기중'}
                    {request.status === 'approved' && '승인'}
                    {request.status === 'rejected' && '거절'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
