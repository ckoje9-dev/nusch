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
import { fetchHolidaysByYear, getHolidaysInMonthFromMap } from '@/lib/scheduler/holidays'
import { useToast } from '@/hooks/use-toast'
import {
  Loader2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Wand2,
  AlertTriangle,
  CheckCircle,
  Copy,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'
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
  const [filterNurseId, setFilterNurseId] = useState<string>('all')
  const [showMonthPicker, setShowMonthPicker] = useState(false)
  const [statsSortKey, setStatsSortKey] = useState<string>('fairness')
  const [statsSortDir, setStatsSortDir] = useState<'asc' | 'desc'>('desc')
  const [holidayMap, setHolidayMap] = useState<Record<string, string>>({})

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

  useEffect(() => {
    const [year] = currentMonth.split('-').map(Number)
    fetchHolidaysByYear(year).then(setHolidayMap)
  }, [currentMonth])

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
      const holidays = getHolidaysInMonthFromMap(holidayMap, year, month).map((h) => h.date)

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
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`
    return {
      date,
      dateStr,
      day: i + 1,
      dayName: getKoreanDayName(date),
      isWeekend: isWeekend(date),
      holidayName: holidayMap[dateStr] ?? null,
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
          <div className="text-center relative">
            <button
              onClick={() => setShowMonthPicker(!showMonthPicker)}
              className="text-xl font-bold hover:text-blue-600 transition-colors cursor-pointer"
            >
              {year}년 {month}월
            </button>
            {showMonthPicker && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white border rounded-lg shadow-lg z-50 p-3 w-[280px]">
                {/* Year navigation */}
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
                {/* Month grid */}
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
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="calendar">캘린더</TabsTrigger>
            <TabsTrigger value="stats">통계</TabsTrigger>
          </TabsList>

          {/* Calendar View - Google Calendar Style */}
          <TabsContent value="calendar">
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
                      const dayViolations = schedule.violations.filter((v) => v.date === d.dateStr)
                      const dayOfWeek = d.date.getDay()
                      const isSunday = dayOfWeek === 0
                      const isSaturday = dayOfWeek === 6

                      // When filtering by nurse, find their shift for this day
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
                            d.holidayName ? 'bg-red-50/60' : d.isWeekend ? 'bg-gray-50/80' : 'bg-white'
                          )}
                        >
                          {/* Date number */}
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1">
                              <span
                                className={cn(
                                  'text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full',
                                  (isSunday || d.holidayName) && 'text-red-500',
                                  isSaturday && !d.holidayName && 'text-blue-500',
                                  !isSunday && !isSaturday && !d.holidayName && 'text-gray-700'
                                )}
                              >
                                {d.day}
                              </span>
                              {d.holidayName && (
                                <span className="text-[10px] text-red-400 font-medium leading-tight hidden sm:block truncate max-w-[60px]">
                                  {d.holidayName}
                                </span>
                              )}
                            </div>
                            {dayViolations.length > 0 && (
                              <div className="relative group">
                                <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 cursor-pointer" />
                                <div className="absolute right-0 top-full mt-1 hidden group-hover:block z-50">
                                  <div className="bg-gray-900 text-white text-xs rounded px-2 py-1.5 whitespace-nowrap shadow-lg max-w-[250px]">
                                    {dayViolations.map((v, i) => {
                                      const nurse = staff.find((s) => s.id === v.userId)
                                      return (
                                        <div key={i} className="py-0.5">
                                          <span className="font-medium">{nurse?.name}</span>: {v.reason}
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              </div>
                            )}
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
                        {SHIFT_SHORT[type]} - {type === 'day' ? 'Day' : type === 'evening' ? 'Evening' : type === 'night' ? 'Night' : 'Charge'}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
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
                    {(() => {
                      const toggleSort = (key: string) => {
                        if (statsSortKey === key) {
                          setStatsSortDir(statsSortDir === 'asc' ? 'desc' : 'asc')
                        } else {
                          setStatsSortKey(key)
                          setStatsSortDir(key === 'name' ? 'asc' : 'desc')
                        }
                      }

                      const SortIcon = ({ col }: { col: string }) => {
                        if (statsSortKey !== col) return null
                        return statsSortDir === 'asc'
                          ? <ArrowUp className="inline h-3 w-3 ml-0.5" />
                          : <ArrowDown className="inline h-3 w-3 ml-0.5" />
                      }

                      // Calculate average weighted hours for non-dedicated nurses
                      const nonDedicatedStaff = staff.filter((n) => !n.personalRules.dedicatedRole)
                      const avgWeightedHours = nonDedicatedStaff.length > 0
                        ? nonDedicatedStaff.reduce((sum, n) => sum + (schedule.statistics[n.id]?.weightedHours || 0), 0) / nonDedicatedStaff.length
                        : 0

                      // Build all nurse rows with stats
                      const allRows = staff.map((nurse) => {
                        const stats = schedule.statistics[nurse.id]
                        const rankItem = ranking.find((r) => r.userId === nurse.id)
                        const isDedicated = !!nurse.personalRules.dedicatedRole
                        const workDays = (stats?.dayCount || 0) + (stats?.eveningCount || 0) + (stats?.nightCount || 0) + (stats?.chargeCount || 0)
                        return {
                          nurse,
                          stats,
                          isDedicated,
                          workDays,
                          fairnessScore: rankItem?.fairnessScore ?? -1,
                        }
                      })

                      // Sort
                      const sorted = [...allRows].sort((a, b) => {
                        const dir = statsSortDir === 'asc' ? 1 : -1
                        switch (statsSortKey) {
                          case 'name': return dir * a.nurse.name.localeCompare(b.nurse.name, 'ko')
                          case 'totalHours': return dir * ((a.stats?.totalHours || 0) - (b.stats?.totalHours || 0))
                          case 'weightedHours': return dir * ((a.stats?.weightedHours || 0) - (b.stats?.weightedHours || 0))
                          case 'workDays': return dir * (a.workDays - b.workDays)
                          case 'day': return dir * ((a.stats?.dayCount || 0) - (b.stats?.dayCount || 0))
                          case 'evening': return dir * ((a.stats?.eveningCount || 0) - (b.stats?.eveningCount || 0))
                          case 'night': return dir * ((a.stats?.nightCount || 0) - (b.stats?.nightCount || 0))
                          case 'charge': return dir * ((a.stats?.chargeCount || 0) - (b.stats?.chargeCount || 0))
                          case 'off': return dir * ((a.stats?.offCount || 0) - (b.stats?.offCount || 0))
                          case 'fairness': {
                            // Sort by distance from average (absolute deviation)
                            const da = a.isDedicated ? Infinity : Math.abs((a.stats?.weightedHours || 0) - avgWeightedHours)
                            const db = b.isDedicated ? Infinity : Math.abs((b.stats?.weightedHours || 0) - avgWeightedHours)
                            return dir * (da - db)
                          }
                          default: return 0
                        }
                      })

                      const thClass = 'text-right p-2 cursor-pointer hover:bg-gray-50 select-none whitespace-nowrap'

                      return (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left p-2 cursor-pointer hover:bg-gray-50 select-none" onClick={() => toggleSort('name')}>
                                이름<SortIcon col="name" />
                              </th>
                              <th className={thClass} onClick={() => toggleSort('workDays')}>
                                근무일수<SortIcon col="workDays" />
                              </th>
                              <th className={thClass} onClick={() => toggleSort('day')}>
                                Day<SortIcon col="day" />
                              </th>
                              <th className={thClass} onClick={() => toggleSort('evening')}>
                                Evening<SortIcon col="evening" />
                              </th>
                              <th className={thClass} onClick={() => toggleSort('night')}>
                                Night<SortIcon col="night" />
                              </th>
                              <th className={thClass} onClick={() => toggleSort('charge')}>
                                Charge<SortIcon col="charge" />
                              </th>
                              <th className={thClass} onClick={() => toggleSort('off')}>
                                Off<SortIcon col="off" />
                              </th>
                              <th className={thClass} onClick={() => toggleSort('totalHours')}>
                                실제 근무 시간<SortIcon col="totalHours" />
                              </th>
                              <th className={thClass} onClick={() => toggleSort('weightedHours')}>
                                가중 시간<SortIcon col="weightedHours" />
                              </th>
                              <th className={thClass} onClick={() => toggleSort('fairness')}>
                                근무 부담<SortIcon col="fairness" />
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {sorted.map(({ nurse, stats, isDedicated, workDays }) => {
                              const roleLabel = nurse.personalRules.dedicatedRole === 'night' ? 'Night 전담' : nurse.personalRules.dedicatedRole === 'charge' ? 'Charge 전담' : null
                              return (
                                <tr key={nurse.id} className={cn('border-b', isDedicated && 'bg-gray-50')}>
                                  <td className="p-2">
                                    {nurse.name}
                                    {roleLabel && <span className="ml-1 text-xs text-gray-400">({roleLabel})</span>}
                                  </td>
                                  <td className="text-right p-2 font-medium">{workDays}</td>
                                  <td className="text-right p-2">{stats?.dayCount || 0}</td>
                                  <td className="text-right p-2">{stats?.eveningCount || 0}</td>
                                  <td className="text-right p-2">{stats?.nightCount || 0}</td>
                                  <td className="text-right p-2">{stats?.chargeCount || 0}</td>
                                  <td className="text-right p-2">{stats?.offCount || 0}</td>
                                  <td className="text-right p-2">{stats?.totalHours || 0}h</td>
                                  <td className="text-right p-2">{stats?.weightedHours.toFixed(1) || 0}</td>
                                  <td className="text-right p-2">
                                    {isDedicated ? (
                                      <span className="px-2 py-1 rounded text-sm bg-gray-100 text-gray-500">제외</span>
                                    ) : (() => {
                                      const wh = stats?.weightedHours || 0
                                      const diff = avgWeightedHours > 0 ? (wh - avgWeightedHours) / avgWeightedHours : 0
                                      // within 5% of average → 적당, above → 과중, below → 경미
                                      const label = diff > 0.05 ? '과중' : diff < -0.05 ? '경미' : '적당'
                                      const colorClass = diff > 0.05
                                        ? 'bg-red-100 text-red-700'
                                        : diff < -0.05
                                        ? 'bg-yellow-100 text-yellow-700'
                                        : 'bg-green-100 text-green-700'
                                      return (
                                        <span className={cn('px-2 py-1 rounded text-sm', colorClass)}>
                                          {label}
                                        </span>
                                      )
                                    })()}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      )
                    })()}
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
