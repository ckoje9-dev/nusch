'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getOrganizationByShareLink, getScheduleByMonth, getUsersByOrganization } from '@/lib/firebase/firestore'
import { Loader2, Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn, getKoreanDayName, isWeekend } from '@/lib/utils'
import type { Schedule, Organization, User, ShiftType } from '@/types'

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

export default function SharePage() {
  const params = useParams()
  const shareId = params.id as string

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [staff, setStaff] = useState<User[]>([])
  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  const loadData = async () => {
    setLoading(true)
    try {
      const org = await getOrganizationByShareLink(shareId)

      if (!org) {
        setNotFound(true)
        setLoading(false)
        return
      }

      setOrganization(org)

      const [users, existingSchedule] = await Promise.all([
        getUsersByOrganization(org.id),
        getScheduleByMonth(org.id, currentMonth),
      ])

      setStaff(users.filter((u) => u.role === 'nurse'))
      setSchedule(existingSchedule)
    } catch (error) {
      console.error('Failed to load data:', error)
      setNotFound(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [shareId, currentMonth])

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md">
          <CardContent className="flex flex-col items-center py-12">
            <Calendar className="h-12 w-12 text-gray-300 mb-4" />
            <h2 className="text-xl font-bold mb-2">페이지를 찾을 수 없습니다</h2>
            <p className="text-gray-500 text-center">
              유효하지 않은 공유 링크입니다.
              <br />
              링크를 다시 확인해주세요.
            </p>
          </CardContent>
        </Card>
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

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Calendar className="h-8 w-8 text-blue-600" />
            <span className="text-2xl font-bold text-blue-600">NuSch</span>
          </div>
          <h1 className="text-2xl font-bold">{organization?.name}</h1>
          <p className="text-gray-500">근무표</p>
        </div>

        {/* Month Selector */}
        <Card className="mb-6">
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

        {!schedule || schedule.status !== 'published' ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Calendar className="h-12 w-12 text-gray-300 mb-4" />
              <p className="text-gray-500">이 달의 근무표가 아직 공개되지 않았습니다.</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-2 sm:p-4 overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr>
                    <th className="p-2 text-left font-medium text-gray-500 w-24 sticky left-0 bg-white">
                      이름
                    </th>
                    {days.map((d) => (
                      <th
                        key={d.dateStr}
                        className={cn(
                          'p-1 text-center text-xs',
                          d.isWeekend ? 'text-red-500' : 'text-gray-500'
                        )}
                      >
                        <div>{d.day}</div>
                        <div>{d.dayName}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {staff.map((nurse) => (
                    <tr key={nurse.id} className="border-t">
                      <td className="p-2 font-medium text-sm whitespace-nowrap sticky left-0 bg-white">
                        {nurse.name}
                      </td>
                      {days.map((d) => {
                        const assignment = schedule.assignments[d.dateStr]
                        let shiftType: ShiftType = 'off'

                        for (const type of ['day', 'evening', 'night', 'charge', 'off'] as ShiftType[]) {
                          if (assignment?.[type]?.includes(nurse.id)) {
                            shiftType = type
                            break
                          }
                        }

                        return (
                          <td key={d.dateStr} className="p-1 text-center">
                            <span
                              className={cn(
                                'inline-flex items-center justify-center w-6 h-6 text-xs font-semibold rounded',
                                SHIFT_COLORS[shiftType]
                              )}
                            >
                              {SHIFT_SHORT[shiftType]}
                            </span>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {/* Legend */}
        <Card className="mt-6">
          <CardContent className="py-4">
            <div className="flex flex-wrap justify-center gap-4">
              {(['day', 'evening', 'night', 'charge', 'off'] as ShiftType[]).map((type) => (
                <div key={type} className="flex items-center gap-2">
                  <span
                    className={cn(
                      'inline-flex items-center justify-center w-6 h-6 text-xs font-semibold rounded',
                      SHIFT_COLORS[type]
                    )}
                  >
                    {SHIFT_SHORT[type]}
                  </span>
                  <span className="text-sm">
                    {type === 'day' && 'Day (07:00-15:30)'}
                    {type === 'evening' && 'Evening (15:00-23:00)'}
                    {type === 'night' && 'Night (22:30-07:30)'}
                    {type === 'charge' && 'Charge (10:00-18:30)'}
                    {type === 'off' && 'Off (휴무)'}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-gray-400 text-sm mt-8">
          Powered by NuSch
        </div>
      </div>
    </div>
  )
}
