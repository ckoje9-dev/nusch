'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/lib/firebase/auth-context'
import {
  getOrganization,
  getUsersByOrganization,
  getScheduleByMonth,
  createSchedule,
  deleteSchedule,
  updateSchedule,
} from '@/lib/firebase/firestore'
import { generateSchedule } from '@/lib/scheduler/generator'
import { calculateOverallFairness, rankByFairness } from '@/lib/scheduler/fairness'
import { getHolidaysInMonth } from '@/lib/scheduler/holidays'
import { useToast } from '@/hooks/use-toast'
import {
  Loader2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Share2,
  Download,
  Wand2,
  AlertTriangle,
  CheckCircle,
  Copy,
} from 'lucide-react'
import { cn, getKoreanDayName, isWeekend } from '@/lib/utils'
import type { Schedule, Organization, User, ShiftType, SHIFT_LABELS } from '@/types'

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

export default function SchedulePage() {
  const { userData } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [staff, setStaff] = useState<User[]>([])
  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  const loadData = async () => {
    if (!userData?.organizationId) return

    setLoading(true)
    try {
      const [org, users, existingSchedule] = await Promise.all([
        getOrganization(userData.organizationId),
        getUsersByOrganization(userData.organizationId),
        getScheduleByMonth(userData.organizationId, currentMonth),
      ])

      setOrganization(org)
      setStaff(users.filter((u) => u.role === 'nurse'))
      setSchedule(existingSchedule)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [userData?.organizationId, currentMonth])

  const handleGenerate = async () => {
    if (!organization || staff.length === 0) {
      toast({
        title: '생성 불가',
        description: '근무자를 먼저 등록해주세요.',
        variant: 'destructive',
      })
      return
    }

    setGenerating(true)
    try {
      const [year, month] = currentMonth.split('-').map(Number)
      const holidays = getHolidaysInMonth(year, month).map((h) => h.date)

      const newSchedule = generateSchedule({
        organization,
        users: staff,
        yearMonth: currentMonth,
        holidays,
      })

      // Save to Firestore (delete old + create new for reliable update)
      if (schedule?.id) {
        await deleteSchedule(schedule.id)
      }
      const id = await createSchedule(newSchedule)
      setSchedule({ ...newSchedule, id })

      toast({
        title: '생성 완료',
        description: `${currentMonth} 근무표가 생성되었습니다.`,
      })
    } catch (error) {
      console.error('Failed to generate schedule:', error)
      toast({
        title: '생성 실패',
        description: '다시 시도해주세요.',
        variant: 'destructive',
      })
    } finally {
      setGenerating(false)
    }
  }

  const handlePublish = async () => {
    if (!schedule) return

    try {
      await updateSchedule(schedule.id, { status: 'published' })
      setSchedule({ ...schedule, status: 'published' })
      toast({
        title: '발행 완료',
        description: '근무표가 발행되었습니다.',
      })
    } catch (error) {
      toast({
        title: '발행 실패',
        description: '다시 시도해주세요.',
        variant: 'destructive',
      })
    }
  }

  const copyShareLink = () => {
    if (!organization) return
    const link = `${window.location.origin}/share/${organization.shareLink}`
    navigator.clipboard.writeText(link)
    toast({
      title: '복사됨',
      description: '공유 링크가 클립보드에 복사되었습니다.',
    })
  }

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

  // Exclude dedicated nurses (fairnessScore === -1) from fairness calculations
  const nonDedicatedStats = schedule?.statistics
    ? Object.fromEntries(
        Object.entries(schedule.statistics).filter(([, s]) => s.fairnessScore !== -1)
      )
    : null

  const fairness = nonDedicatedStats
    ? calculateOverallFairness(nonDedicatedStats)
    : null

  const ranking = nonDedicatedStats
    ? rankByFairness(nonDedicatedStats as Record<string, { weightedHours: number; fairnessScore: number }>)
    : []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">근무표 관리</h1>
          <p className="text-gray-500">{organization?.name}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={copyShareLink}>
            <Copy className="h-4 w-4 mr-2" />
            링크 복사
          </Button>
          <Button onClick={handleGenerate} disabled={generating}>
            {generating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4 mr-2" />
            )}
            자동 생성
          </Button>
        </div>
      </div>

      {/* Month Selector */}
      <Card>
        <CardContent className="flex items-center justify-between py-4">
          <Button variant="ghost" size="icon" onClick={prevMonth}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="text-center">
            <p className="text-xl font-bold">{year}년 {month}월</p>
            {schedule && (
              <span
                className={cn(
                  'text-xs px-2 py-1 rounded',
                  schedule.status === 'published'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-yellow-100 text-yellow-700'
                )}
              >
                {schedule.status === 'published' ? '발행됨' : '초안'}
              </span>
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
            <p className="text-gray-500 mb-4">이 달의 근무표가 없습니다.</p>
            <Button onClick={handleGenerate} disabled={generating || staff.length === 0}>
              {generating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4 mr-2" />
              )}
              근무표 자동 생성
            </Button>
            {staff.length === 0 && (
              <p className="text-sm text-red-500 mt-2">
                먼저 근무자를 등록해주세요.
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="calendar">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="calendar">캘린더</TabsTrigger>
            <TabsTrigger value="list">목록</TabsTrigger>
            <TabsTrigger value="stats">통계</TabsTrigger>
          </TabsList>

          {/* Calendar View */}
          <TabsContent value="calendar">
            <Card>
              <CardContent className="p-2 sm:p-4 overflow-x-auto">
                <table className="w-full min-w-[600px]">
                  <thead>
                    <tr>
                      <th className="p-2 text-left font-medium text-gray-500 w-24">
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
                        <td className="p-2 font-medium text-sm whitespace-nowrap">
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

                          // Check if this cell has violations
                          const cellViolations = schedule.violations.filter(
                            (v) => v.userId === nurse.id && v.date === d.dateStr
                          )

                          return (
                            <td key={d.dateStr} className="p-1 text-center">
                              <div className="relative inline-flex group">
                                <span
                                  className={cn(
                                    'inline-flex items-center justify-center w-6 h-6 text-xs font-semibold rounded',
                                    SHIFT_COLORS[shiftType],
                                    cellViolations.length > 0 && 'ring-2 ring-yellow-400'
                                  )}
                                >
                                  {SHIFT_SHORT[shiftType]}
                                </span>
                                {cellViolations.length > 0 && (
                                  <>
                                    <AlertTriangle className="absolute -top-1.5 -right-1.5 h-3 w-3 text-yellow-500" />
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50">
                                      <div className="bg-gray-900 text-white text-xs rounded px-2 py-1.5 whitespace-nowrap shadow-lg">
                                        {cellViolations.map((v, i) => (
                                          <div key={i}>{v.reason}</div>
                                        ))}
                                      </div>
                                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                                    </div>
                                  </>
                                )}
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* List View */}
          <TabsContent value="list">
            <div className="space-y-4">
              {days.map((d) => {
                const assignment = schedule.assignments[d.dateStr]
                if (!assignment) return null

                return (
                  <Card key={d.dateStr}>
                    <CardHeader className="py-3">
                      <CardTitle
                        className={cn(
                          'text-lg',
                          d.isWeekend && 'text-red-600'
                        )}
                      >
                        {d.day}일 ({d.dayName})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="py-2">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {(['day', 'evening', 'night', 'charge'] as ShiftType[]).map(
                          (type) => (
                            <div key={type}>
                              <p
                                className={cn(
                                  'text-xs font-semibold mb-1 px-2 py-1 rounded inline-block',
                                  SHIFT_COLORS[type]
                                )}
                              >
                                {type.toUpperCase()}
                              </p>
                              <div className="space-y-1">
                                {assignment[type]?.map((id) => {
                                  const nurse = staff.find((s) => s.id === id)
                                  return nurse ? (
                                    <p key={id} className="text-sm">
                                      {nurse.name}
                                    </p>
                                  ) : null
                                })}
                                {(!assignment[type] || assignment[type].length === 0) && (
                                  <p className="text-sm text-gray-400">-</p>
                                )}
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </TabsContent>

          {/* Statistics View */}
          <TabsContent value="stats">
            <div className="space-y-6">
              {/* Overall Fairness */}
              {fairness && (
                <Card>
                  <CardHeader>
                    <CardTitle>공평성 지표</CardTitle>
                    <CardDescription>
                      근무 시간의 공평한 분배 정도를 나타냅니다.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                      <div>
                        <p
                          className={cn(
                            'text-3xl font-bold',
                            fairness.fairnessIndex >= 80
                              ? 'text-green-600'
                              : fairness.fairnessIndex >= 60
                              ? 'text-yellow-600'
                              : 'text-red-600'
                          )}
                        >
                          {fairness.fairnessIndex}
                        </p>
                        <p className="text-sm text-gray-500">공평성 점수</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{fairness.average}</p>
                        <p className="text-sm text-gray-500">평균 (가중)</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{fairness.stdDev}</p>
                        <p className="text-sm text-gray-500">표준편차</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{fairness.min}</p>
                        <p className="text-sm text-gray-500">최소</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{fairness.max}</p>
                        <p className="text-sm text-gray-500">최대</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Individual Stats */}
              <Card>
                <CardHeader>
                  <CardTitle>개인별 통계</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">이름</th>
                          <th className="text-right p-2">총 시간</th>
                          <th className="text-right p-2">가중 시간</th>
                          <th className="text-right p-2">Charge</th>
                          <th className="text-right p-2">공평성</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Non-dedicated nurses (ranked by fairness) */}
                        {ranking.map((r) => {
                          const nurse = staff.find((s) => s.id === r.userId)
                          const stats = schedule.statistics[r.userId]
                          return (
                            <tr key={r.userId} className="border-b">
                              <td className="p-2">{nurse?.name}</td>
                              <td className="text-right p-2">{stats?.totalHours || 0}h</td>
                              <td className="text-right p-2">{stats?.weightedHours.toFixed(1) || 0}</td>
                              <td className="text-right p-2">{stats?.chargeCount || 0}회</td>
                              <td className="text-right p-2">
                                <span
                                  className={cn(
                                    'px-2 py-1 rounded text-sm',
                                    r.fairnessScore >= 80
                                      ? 'bg-green-100 text-green-700'
                                      : r.fairnessScore >= 60
                                      ? 'bg-yellow-100 text-yellow-700'
                                      : 'bg-red-100 text-red-700'
                                  )}
                                >
                                  {r.fairnessScore}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                        {/* Dedicated nurses (excluded from fairness) */}
                        {staff
                          .filter((n) => n.personalRules.dedicatedRole)
                          .map((nurse) => {
                            const stats = schedule.statistics[nurse.id]
                            if (!stats) return null
                            const roleLabel = nurse.personalRules.dedicatedRole === 'night' ? 'Night 전담' : 'Charge 전담'
                            return (
                              <tr key={nurse.id} className="border-b bg-gray-50">
                                <td className="p-2">
                                  {nurse.name}
                                  <span className="ml-1 text-xs text-gray-400">({roleLabel})</span>
                                </td>
                                <td className="text-right p-2">{stats.totalHours || 0}h</td>
                                <td className="text-right p-2">{stats.weightedHours.toFixed(1)}</td>
                                <td className="text-right p-2">{stats.chargeCount || 0}회</td>
                                <td className="text-right p-2">
                                  <span className="px-2 py-1 rounded text-sm bg-gray-100 text-gray-500">
                                    제외
                                  </span>
                                </td>
                              </tr>
                            )
                          })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Violations */}
              {schedule.violations.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-yellow-500" />
                      규칙 위반 사항
                    </CardTitle>
                    <CardDescription>
                      불가피하게 규칙을 위반한 배치입니다.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {schedule.violations.map((v, i) => {
                        const nurse = staff.find((s) => s.id === v.userId)
                        return (
                          <div
                            key={i}
                            className="flex items-start gap-2 p-2 bg-yellow-50 rounded"
                          >
                            <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5" />
                            <div>
                              <p className="font-medium">
                                {nurse?.name} - {v.date}
                              </p>
                              <p className="text-sm text-gray-600">{v.reason}</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Publish Button */}
              {schedule.status === 'draft' && (
                <div className="flex justify-center">
                  <Button size="lg" onClick={handlePublish}>
                    <CheckCircle className="h-5 w-5 mr-2" />
                    근무표 발행하기
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
