'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/firebase/auth-context'
import { getScheduleByMonth, getUsersByOrganization } from '@/lib/firebase/firestore'
import { useToast } from '@/hooks/use-toast'
import {
  Loader2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  Clock,
} from 'lucide-react'
import { cn, getKoreanDayName, isWeekend } from '@/lib/utils'
import type { Schedule, User, ShiftType } from '@/types'
import { SHIFT_TIMES } from '@/types'

const SHIFT_COLORS: Record<ShiftType, string> = {
  day: 'bg-blue-500',
  evening: 'bg-amber-500',
  night: 'bg-indigo-500',
  charge: 'bg-red-500',
  off: 'bg-gray-300',
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
  const [colleagues, setColleagues] = useState<User[]>([])
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  const loadData = async () => {
    if (!userData?.organizationId) return

    setLoading(true)
    try {
      const [existingSchedule, users] = await Promise.all([
        getScheduleByMonth(userData.organizationId, currentMonth),
        getUsersByOrganization(userData.organizationId),
      ])

      setSchedule(existingSchedule)
      setColleagues(users.filter((u) => u.role === 'nurse'))
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

  const getMyShift = (dateStr: string): { type: ShiftType; time: string } | null => {
    if (!schedule || !userData) return null

    const assignment = schedule.assignments[dateStr]
    if (!assignment) return null

    for (const type of ['day', 'evening', 'night', 'charge', 'off'] as ShiftType[]) {
      if (assignment[type]?.includes(userData.id)) {
        const times = SHIFT_TIMES[type]
        return {
          type,
          time: times.start ? `${times.start} - ${times.end}` : '휴무',
        }
      }
    }
    return null
  }

  const exportToGoogleCalendar = () => {
    if (!schedule || !userData) return

    // Generate ICS content
    const events: string[] = []
    const [year, month] = currentMonth.split('-').map(Number)
    const daysInMonth = new Date(year, month, 0).getDate()

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const shift = getMyShift(dateStr)

      if (shift && shift.type !== 'off') {
        const times = SHIFT_TIMES[shift.type]
        const [startH, startM] = times.start.split(':').map(Number)
        const [endH, endM] = times.end.split(':').map(Number)

        const startDate = new Date(year, month - 1, day, startH, startM)
        const endDate = new Date(year, month - 1, day, endH, endM)

        // Handle night shift ending next day
        if (shift.type === 'night') {
          endDate.setDate(endDate.getDate() + 1)
        }

        const formatDate = (d: Date) =>
          d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

        events.push(`BEGIN:VEVENT
DTSTART:${formatDate(startDate)}
DTEND:${formatDate(endDate)}
SUMMARY:${SHIFT_LABELS[shift.type]} 근무
DESCRIPTION:NuSch 근무표
END:VEVENT`)
      }
    }

    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//NuSch//Nurse Schedule//KO
${events.join('\n')}
END:VCALENDAR`

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `nusch_${currentMonth}.ics`
    a.click()
    URL.revokeObjectURL(url)

    toast({
      title: '내보내기 완료',
      description: 'Google Calendar에서 가져오기하세요.',
    })
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

  // My statistics
  const myStats = schedule?.statistics[userData?.id || '']

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">내 근무표</h1>
          <p className="text-gray-500">{userData?.name}</p>
        </div>
        <Button variant="outline" onClick={exportToGoogleCalendar} disabled={!schedule}>
          <Download className="h-4 w-4 mr-2" />
          캘린더 내보내기
        </Button>
      </div>

      {/* Month Selector */}
      <Card>
        <CardContent className="flex items-center justify-between py-4">
          <Button variant="ghost" size="icon" onClick={prevMonth}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <p className="text-xl font-bold">{year}년 {month}월</p>
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
          {/* My Stats */}
          {myStats && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">이번 달 통계</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-blue-600">
                      {myStats.totalHours}h
                    </p>
                    <p className="text-sm text-gray-500">총 근무시간</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-indigo-600">
                      {myStats.chargeCount}회
                    </p>
                    <p className="text-sm text-gray-500">Charge</p>
                  </div>
                  <div>
                    <p
                      className={cn(
                        'text-2xl font-bold',
                        myStats.fairnessScore >= 80
                          ? 'text-green-600'
                          : myStats.fairnessScore >= 60
                          ? 'text-yellow-600'
                          : 'text-red-600'
                      )}
                    >
                      {myStats.fairnessScore}
                    </p>
                    <p className="text-sm text-gray-500">공평성</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Calendar */}
          <div className="grid grid-cols-7 gap-2">
            {['일', '월', '화', '수', '목', '금', '토'].map((day, i) => (
              <div
                key={day}
                className={cn(
                  'text-center text-sm font-medium py-2',
                  i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-500'
                )}
              >
                {day}
              </div>
            ))}

            {/* Empty cells for first week */}
            {Array.from({ length: new Date(year, month - 1, 1).getDay() }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}

            {/* Days */}
            {days.map((d) => {
              const shift = getMyShift(d.dateStr)

              return (
                <Card
                  key={d.dateStr}
                  className={cn(
                    'p-2 min-h-[80px]',
                    d.isWeekend && 'bg-gray-50'
                  )}
                >
                  <p
                    className={cn(
                      'text-sm font-medium',
                      d.date.getDay() === 0 && 'text-red-500',
                      d.date.getDay() === 6 && 'text-blue-500'
                    )}
                  >
                    {d.day}
                  </p>
                  {shift && (
                    <div className="mt-1">
                      <span
                        className={cn(
                          'inline-block w-full text-center text-white text-xs font-semibold py-1 rounded',
                          SHIFT_COLORS[shift.type]
                        )}
                      >
                        {SHIFT_LABELS[shift.type]}
                      </span>
                      {shift.type !== 'off' && (
                        <p className="text-[10px] text-gray-500 mt-1 text-center">
                          {SHIFT_TIMES[shift.type].start}
                        </p>
                      )}
                    </div>
                  )}
                </Card>
              )
            })}
          </div>

          {/* Legend */}
          <Card>
            <CardContent className="py-4">
              <div className="flex flex-wrap justify-center gap-4">
                {(['day', 'evening', 'night', 'charge', 'off'] as ShiftType[]).map((type) => (
                  <div key={type} className="flex items-center gap-2">
                    <div className={cn('w-4 h-4 rounded', SHIFT_COLORS[type])} />
                    <span className="text-sm">
                      {SHIFT_LABELS[type]}
                      {type !== 'off' && (
                        <span className="text-gray-500 ml-1">
                          ({SHIFT_TIMES[type].start}-{SHIFT_TIMES[type].end})
                        </span>
                      )}
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
