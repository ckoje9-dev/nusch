'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/firebase/auth-context'
import { getScheduleByMonth, getUsersByOrganization } from '@/lib/firebase/firestore'
import { useToast } from '@/hooks/use-toast'
import {
  Loader2,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { cn, getKoreanDayName, isWeekend } from '@/lib/utils'
import type { Schedule, User, ShiftType } from '@/types'
import { SHIFT_TIMES } from '@/types'
import { requestCalendarAccess, syncToGoogleCalendar } from '@/lib/google-calendar'
import type { CalendarEvent } from '@/lib/google-calendar'

const SHIFT_COLORS: Record<ShiftType, string> = {
  day: 'bg-blue-100 text-blue-800',
  evening: 'bg-amber-100 text-amber-800',
  night: 'bg-indigo-100 text-indigo-800',
  charge: 'bg-red-100 text-red-800',
  off: 'bg-gray-100 text-gray-600',
}

const SHIFT_SHORT: Record<ShiftType, string> = {
  day: 'D',
  evening: 'E',
  night: 'N',
  charge: 'C',
  off: 'O',
}

const SHIFT_LABELS: Record<ShiftType, string> = {
  day: 'Day',
  evening: 'Evening',
  night: 'Night',
  charge: 'Charge',
  off: 'Off',
}

export default function NurseSchedulePage() {
  const { userData } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [staff, setStaff] = useState<User[]>([])
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [filterNurseId, setFilterNurseId] = useState<string>(userData?.id || 'all')
  const [showMonthPicker, setShowMonthPicker] = useState(false)

  const loadData = async () => {
    if (!userData?.organizationId) return

    setLoading(true)
    try {
      const [existingSchedule, users] = await Promise.all([
        getScheduleByMonth(userData.organizationId, currentMonth),
        getUsersByOrganization(userData.organizationId),
      ])

      setSchedule(existingSchedule)
      setStaff(users.filter((u) => u.role === 'nurse'))
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [userData?.organizationId, currentMonth])

  const prevMonth = () => {
    const [year, month] = currentMonth.split('-').map(Number)
    const prev = month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, '0')}`
    setCurrentMonth(prev)
  }

  const nextMonth = () => {
    const [year, month] = currentMonth.split('-').map(Number)
    const next = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`
    setCurrentMonth(next)
  }

  const [syncing, setSyncing] = useState(false)

  const handleGoogleCalendarSync = async () => {
    if (!schedule || !userData) return

    setSyncing(true)
    try {
      // 1. OAuth 팝업으로 access token 획득
      const accessToken = await requestCalendarAccess()

      // 2. 내 근무 이벤트 목록 구성
      const [y, m] = currentMonth.split('-').map(Number)
      const dIM = new Date(y, m, 0).getDate()
      const calendarEvents: CalendarEvent[] = []

      for (let day = 1; day <= dIM; day++) {
        const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        const assignment = schedule.assignments[dateStr]
        if (!assignment) continue

        for (const type of ['charge', 'day', 'evening', 'night'] as ShiftType[]) {
          if (assignment[type]?.includes(userData.id)) {
            calendarEvents.push({
              date: dateStr,
              shiftType: type,
              shiftLabel: SHIFT_LABELS[type],
            })
            break
          }
        }
      }

      // 3. Google Calendar에 동기화
      const created = await syncToGoogleCalendar(accessToken, currentMonth, calendarEvents)

      toast({
        title: '동기화 완료',
        description: `Google 캘린더에 ${created}개의 근무 일정이 추가되었습니다.`,
      })
    } catch (error: any) {
      toast({
        title: '동기화 실패',
        description: error.message || '다시 시도해주세요.',
        variant: 'destructive',
      })
    } finally {
      setSyncing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  const [year, month] = currentMonth.split('-').map(Number)
  const daysInMonth = new Date(year, month, 0).getDate()
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const date = new Date(year, month - 1, i + 1)
    return {
      date,
      dateStr: `${year}-${String(month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`,
      day: i + 1,
      dayName: getKoreanDayName(date),
      isWeekend: isWeekend(date),
    }
  })

  // Count my shifts this month
  const myShiftCounts: Record<ShiftType, number> = { day: 0, evening: 0, night: 0, charge: 0, off: 0 }
  if (schedule && userData) {
    for (const d of days) {
      const assignment = schedule.assignments[d.dateStr]
      if (!assignment) continue
      for (const type of ['charge', 'day', 'evening', 'night', 'off'] as ShiftType[]) {
        if (assignment[type]?.includes(userData.id)) {
          myShiftCounts[type]++
          break
        }
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">내 근무표</h1>
          <p className="text-gray-500">{userData?.name}</p>
        </div>
        <Button variant="outline" onClick={handleGoogleCalendarSync} disabled={!schedule || syncing}>
          {syncing ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Calendar className="h-4 w-4 mr-2" />
          )}
          {syncing ? '동기화 중...' : 'Google 캘린더 동기화'}
        </Button>
      </div>

      {/* Month Selector */}
      <Card>
        <CardContent className="flex items-center justify-between py-4">
          <Button variant="ghost" size="icon" onClick={prevMonth}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="text-center relative">
            <button
              onClick={() => setShowMonthPicker(!showMonthPicker)}
              className="text-xl font-bold hover:text-blue-600 transition-colors cursor-pointer"
            >
              {year}년 {month}월
            </button>
            {showMonthPicker && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white border rounded-lg shadow-lg z-50 p-3 w-[280px]">
                <div className="flex items-center justify-between mb-2">
                  <button
                    onClick={() => setCurrentMonth(`${year - 1}-${String(month).padStart(2, '0')}`)}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="font-semibold">{year}년</span>
                  <button
                    onClick={() => setCurrentMonth(`${year + 1}-${String(month).padStart(2, '0')}`)}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <button
                      key={m}
                      onClick={() => {
                        setCurrentMonth(`${year}-${String(m).padStart(2, '0')}`)
                        setShowMonthPicker(false)
                      }}
                      className={cn(
                        'py-2 text-sm rounded hover:bg-blue-50 transition-colors',
                        m === month
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'text-gray-700'
                      )}
                    >
                      {m}월
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={nextMonth}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </CardContent>
      </Card>

      {!schedule ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-gray-300 mb-4" />
            <p className="text-gray-500">이 달의 근무표가 아직 없습니다.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* My Shift Counts */}
          <Card>
            <CardContent className="py-4">
              <div className="flex flex-wrap justify-center gap-4">
                {(['day', 'evening', 'night', 'charge', 'off'] as ShiftType[]).map((type) => (
                  <div key={type} className="flex items-center gap-2">
                    <span
                      className={cn(
                        'inline-flex items-center justify-center w-7 h-7 text-xs font-bold rounded',
                        SHIFT_COLORS[type]
                      )}
                    >
                      {SHIFT_SHORT[type]}
                    </span>
                    <span className="text-sm font-medium">
                      {myShiftCounts[type]}회
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Calendar View - Google Calendar Style */}
          <Card>
            <CardContent className="p-2 sm:p-4">
              {/* Filter dropdown */}
              <div className="flex justify-end mb-3">
                <select
                  value={filterNurseId}
                  onChange={(e) => setFilterNurseId(e.target.value)}
                  className="text-sm border border-gray-300 rounded-md px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">전체 보기</option>
                  {[...staff].sort((a, b) => a.name.localeCompare(b.name, 'ko')).map((nurse) => (
                    <option key={nurse.id} value={nurse.id}>
                      {nurse.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Day of week headers */}
              <div className="grid grid-cols-7 border-b">
                {['일', '월', '화', '수', '목', '금', '토'].map((dayName, i) => (
                  <div
                    key={dayName}
                    className={cn(
                      'py-2 text-center text-sm font-medium',
                      i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-500'
                    )}
                  >
                    {dayName}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7">
                {(() => {
                  const firstDayOfWeek = new Date(year, month - 1, 1).getDay()
                  const cells: React.ReactNode[] = []

                  for (let i = 0; i < firstDayOfWeek; i++) {
                    cells.push(
                      <div key={`empty-${i}`} className="min-h-[120px] border-b border-r bg-gray-50/50" />
                    )
                  }

                  days.forEach((d) => {
                    const assignment = schedule.assignments[d.dateStr]
                    const dayOfWeek = d.date.getDay()
                    const isSunday = dayOfWeek === 0
                    const isSaturday = dayOfWeek === 6

                    const isFiltering = filterNurseId !== 'all'
                    let filteredNurseShift: ShiftType | null = null
                    if (isFiltering && assignment) {
                      for (const type of ['charge', 'day', 'evening', 'night', 'off'] as ShiftType[]) {
                        if (assignment[type]?.includes(filterNurseId)) {
                          filteredNurseShift = type
                          break
                        }
                      }
                    }

                    cells.push(
                      <div
                        key={d.dateStr}
                        className={cn(
                          'min-h-[120px] border-b border-r p-1 relative',
                          d.isWeekend ? 'bg-gray-50/80' : 'bg-white'
                        )}
                      >
                        {/* Date number */}
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className={cn(
                              'text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full',
                              isSunday && 'text-red-500',
                              isSaturday && 'text-blue-500',
                              !isSunday && !isSaturday && 'text-gray-700'
                            )}
                          >
                            {d.day}
                          </span>
                        </div>

                        {/* Shift assignments */}
                        {assignment && !isFiltering && (
                          <div className="space-y-0.5">
                            {(['charge', 'day', 'evening', 'night'] as ShiftType[]).map((type) => {
                              const nurseIds = assignment[type]
                              if (!nurseIds || nurseIds.length === 0) return null

                              return (
                                <div
                                  key={type}
                                  className={cn(
                                    'text-[10px] leading-tight rounded px-1 py-0.5 truncate',
                                    SHIFT_COLORS[type]
                                  )}
                                  title={nurseIds.map((id) => staff.find((s) => s.id === id)?.name).join(', ')}
                                >
                                  <span className="font-bold mr-0.5">{SHIFT_SHORT[type]}</span>
                                  {nurseIds.map((id) => staff.find((s) => s.id === id)?.name).join(', ')}
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {/* Filtered nurse view */}
                        {assignment && isFiltering && filteredNurseShift && (
                          <div className="flex items-center justify-center h-[80px]">
                            <span
                              className={cn(
                                'inline-flex items-center justify-center w-10 h-10 text-base font-bold rounded-lg',
                                SHIFT_COLORS[filteredNurseShift]
                              )}
                            >
                              {SHIFT_SHORT[filteredNurseShift]}
                            </span>
                          </div>
                        )}
                      </div>
                    )
                  })

                  const totalCells = firstDayOfWeek + daysInMonth
                  const remainingCells = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7)
                  for (let i = 0; i < remainingCells; i++) {
                    cells.push(
                      <div key={`trail-${i}`} className="min-h-[120px] border-b border-r bg-gray-50/50" />
                    )
                  }

                  return cells
                })()}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-3 mt-3 px-1">
                {(['charge', 'day', 'evening', 'night'] as ShiftType[]).map((type) => (
                  <div key={type} className="flex items-center gap-1">
                    <span className={cn('inline-block w-3 h-3 rounded', SHIFT_COLORS[type])} />
                    <span className="text-xs text-gray-600">
                      {SHIFT_SHORT[type]} - {SHIFT_LABELS[type]}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
