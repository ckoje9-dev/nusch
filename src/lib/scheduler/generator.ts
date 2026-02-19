import {
  ShiftType,
  User,
  Organization,
  Schedule,
  DailyAssignment,
  UserStatistics,
  Violation,
  SHIFT_TIMES,
  WEIGHTS,
} from '@/types'
import { isWeekend, getDaysInMonth, formatDate } from '@/lib/utils'
import { validateAssignment, ValidationResult } from './validator'
import { calculateFairnessScore, calculateOverallFairness } from './fairness'

interface SchedulerContext {
  organization: Organization
  users: User[]
  yearMonth: string
  holidays: string[]
}

interface NurseScore {
  userId: string
  weightedHours: number
  chargeCount: number
  yearsOfExperience: number
}

const GENERATION_COUNT = 20

export function generateSchedule(ctx: SchedulerContext): Schedule {
  let bestSchedule: Schedule | null = null
  let bestFairness = -1

  for (let i = 0; i < GENERATION_COUNT; i++) {
    const candidate = generateScheduleOnce(ctx)

    const nonDedicatedStats = Object.fromEntries(
      Object.entries(candidate.statistics).filter(([, s]) => s.fairnessScore !== -1)
    )
    const fairness = calculateOverallFairness(nonDedicatedStats)

    if (fairness.fairnessIndex > bestFairness) {
      bestFairness = fairness.fairnessIndex
      bestSchedule = candidate
    }
  }

  return bestSchedule!
}

function generateScheduleOnce(ctx: SchedulerContext): Schedule {
  const { organization, users, yearMonth } = ctx
  const [year, month] = yearMonth.split('-').map(Number)
  const days = getDaysInMonth(year, month - 1)
  const settings = organization.settings

  // Initialize
  const assignments: Record<string, DailyAssignment> = {}
  const nurseScores: Map<string, NurseScore> = new Map()
  const violations: Violation[] = []

  // Initialize nurse scores
  const nurses = users.filter((u) => u.role === 'nurse')
  nurses.forEach((nurse) => {
    nurseScores.set(nurse.id, {
      userId: nurse.id,
      weightedHours: 0,
      chargeCount: 0,
      yearsOfExperience: nurse.yearsOfExperience,
    })
  })

  // Step 1: Pre-assign dedicated roles and vacations
  days.forEach((date) => {
    const dateStr = formatDate(date)
    assignments[dateStr] = {
      day: [],
      evening: [],
      night: [],
      charge: [],
      off: [],
    }

    // Handle vacations - these nurses are automatically off
    nurses.forEach((nurse) => {
      if (nurse.personalRules.vacationDates.includes(dateStr)) {
        assignments[dateStr].off.push(nurse.id)
      }
    })
  })

  // Step 1.5: Pre-assign off days for dedicated nurses (2 consecutive days)
  const nightDedicated = nurses.filter((n) => n.personalRules.dedicatedRole === 'night')
  const chargeDedicated = nurses.filter((n) => n.personalRules.dedicatedRole === 'charge')
  const allDedicated = [...nightDedicated, ...chargeDedicated]

  // For dedicated nurses, assign 2-day consecutive off periods
  allDedicated.forEach((nurse) => {
    // Calculate how many 2-day off periods needed (roughly every 5-6 days of work)
    const totalDays = days.length
    const workDaysTarget = Math.floor(totalDays * 0.7) // ~70% work days
    const offDaysNeeded = totalDays - workDaysTarget
    const offPeriods = Math.floor(offDaysNeeded / 2)

    // Spread off periods evenly across the month
    const interval = Math.floor(totalDays / (offPeriods + 1))

    for (let period = 0; period < offPeriods; period++) {
      // Find the starting day for this off period
      let startIdx = interval * (period + 1) - 1

      // Adjust to avoid already assigned vacation days
      while (startIdx < days.length - 1) {
        const day1Str = formatDate(days[startIdx])
        const day2Str = formatDate(days[startIdx + 1])

        const day1Free = !assignments[day1Str].off.includes(nurse.id)
        const day2Free = !assignments[day2Str].off.includes(nurse.id)

        if (day1Free && day2Free) {
          assignments[day1Str].off.push(nurse.id)
          assignments[day2Str].off.push(nurse.id)
          break
        }
        startIdx++
      }
    }
  })

  // Step 2: Assign Night-dedicated nurses first

  days.forEach((date) => {
    const dateStr = formatDate(date)

    // Assign night-dedicated nurses
    nightDedicated.forEach((nurse) => {
      if (!assignments[dateStr].off.includes(nurse.id)) {
        if (canAssignShift(nurse, dateStr, 'night', assignments, settings, days)) {
          assignments[dateStr].night.push(nurse.id)
          updateScore(nurseScores, nurse.id, date, 'night', settings.chargeSettings.intensityWeight, ctx.holidays)
        }
      }
    })

    // Assign charge-dedicated nurses (only 1 per day)
    // Sort by weighted hours to ensure fairness among dedicated nurses
    const availableChargeDedicated = chargeDedicated
      .filter((nurse) => {
        if (assignments[dateStr].off.includes(nurse.id)) return false
        return canAssignShift(nurse, dateStr, 'charge', assignments, settings, days)
      })
      .sort((a, b) => {
        const scoreA = nurseScores.get(a.id)!.weightedHours
        const scoreB = nurseScores.get(b.id)!.weightedHours
        return scoreA - scoreB
      })

    // Only assign 1 charge per day
    if (availableChargeDedicated.length > 0 && assignments[dateStr].charge.length < 1) {
      const nurse = availableChargeDedicated[0]
      assignments[dateStr].charge.push(nurse.id)
      updateScore(nurseScores, nurse.id, date, 'charge', settings.chargeSettings.intensityWeight, ctx.holidays)
    }
  })

  // Step 3: Fill remaining shifts
  const shiftOrder: ShiftType[] = ['night', 'charge', 'evening', 'day']

  days.forEach((date) => {
    const dateStr = formatDate(date)

    shiftOrder.forEach((shiftType) => {
      if (shiftType === 'off') return

      const requiredCount = getRequiredCount(shiftType, settings)
      const currentCount = assignments[dateStr][shiftType].length

      if (currentCount >= requiredCount) return

      // Get eligible nurses sorted by fairness
      const eligibleNurses = getEligibleNurses(
        nurses,
        dateStr,
        shiftType,
        assignments,
        settings,
        days,
        nurseScores
      )

      // Assign nurses
      const toAssign = requiredCount - currentCount
      for (let i = 0; i < toAssign && i < eligibleNurses.length; i++) {
        const nurse = eligibleNurses[i]
        assignments[dateStr][shiftType].push(nurse.id)
        updateScore(nurseScores, nurse.id, date, shiftType, settings.chargeSettings.intensityWeight, ctx.holidays)
      }

      // Check if we couldn't fill all slots
      if (assignments[dateStr][shiftType].length < requiredCount) {
        // Try to assign with relaxed rules, but NEVER violate forbidden transitions
        const remainingNurses = getAvailableNurses(
          nurses,
          dateStr,
          assignments,
          days
        ).filter((n) => !assignments[dateStr][shiftType].includes(n.id))

        const stillNeeded = requiredCount - assignments[dateStr][shiftType].length
        for (let i = 0; i < stillNeeded && i < remainingNurses.length; i++) {
          const nurse = remainingNurses[i]
          const validation = validateAssignment(nurse, dateStr, shiftType, assignments, settings, days)

          // Never break forbidden transition rules (N→D, E→D, N→E, N→C, C→N)
          if (!validation.valid && validation.violatedRule === 'forbiddenTransition') {
            continue
          }

          if (!validation.valid) {
            violations.push({
              userId: nurse.id,
              date: dateStr,
              rule: validation.violatedRule || 'unknown',
              reason: validation.reason || '규칙 위반',
            })
          }

          assignments[dateStr][shiftType].push(nurse.id)
          updateScore(nurseScores, nurse.id, date, shiftType, settings.chargeSettings.intensityWeight, ctx.holidays)
        }
      }
    })

    // Assign remaining nurses as off
    nurses.forEach((nurse) => {
      const isAssigned = ['day', 'evening', 'night', 'charge', 'off'].some(
        (type) => assignments[dateStr][type as ShiftType].includes(nurse.id)
      )
      if (!isAssigned) {
        assignments[dateStr].off.push(nurse.id)
      }
    })
  })

  // Step 4: Calculate final statistics
  // Exclude dedicated nurses from fairness calculation
  const nonDedicatedScores: Map<string, NurseScore> = new Map()
  nurseScores.forEach((score, id) => {
    const nurse = nurses.find((n) => n.id === id)
    if (nurse && !nurse.personalRules.dedicatedRole) {
      nonDedicatedScores.set(id, score)
    }
  })

  const statistics: Record<string, UserStatistics> = {}
  nurses.forEach((nurse) => {
    const score = nurseScores.get(nurse.id)!
    const totalHours = calculateTotalHours(nurse.id, assignments, days)
    const shiftCounts = calculateShiftCounts(nurse.id, assignments, days)
    const isDedicated = !!nurse.personalRules.dedicatedRole
    statistics[nurse.id] = {
      totalHours,
      weightedHours: score.weightedHours,
      dayCount: shiftCounts.day,
      eveningCount: shiftCounts.evening,
      nightCount: shiftCounts.night,
      chargeCount: score.chargeCount,
      offCount: shiftCounts.off,
      fairnessScore: isDedicated ? -1 : calculateFairnessScore(score.weightedHours, nonDedicatedScores),
    }
  })

  return {
    id: '',
    organizationId: organization.id,
    yearMonth,
    assignments,
    statistics,
    violations,
    status: 'draft',
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function getRequiredCount(
  shiftType: ShiftType,
  settings: Organization['settings']
): number {
  switch (shiftType) {
    case 'day':
      return settings.simultaneousStaff.day
    case 'evening':
      return settings.simultaneousStaff.evening
    case 'night':
      return settings.simultaneousStaff.night
    case 'charge':
      return 1 // Usually 1 charge per shift
    default:
      return 0
  }
}

function canAssignShift(
  nurse: User,
  dateStr: string,
  shiftType: ShiftType,
  assignments: Record<string, DailyAssignment>,
  settings: Organization['settings'],
  allDays: Date[]
): boolean {
  const validation = validateAssignment(nurse, dateStr, shiftType, assignments, settings, allDays)
  return validation.valid
}

function getEligibleNurses(
  nurses: User[],
  dateStr: string,
  shiftType: ShiftType,
  assignments: Record<string, DailyAssignment>,
  settings: Organization['settings'],
  allDays: Date[],
  nurseScores: Map<string, NurseScore>
): User[] {
  return nurses
    .filter((nurse) => {
      // Skip if already assigned for this day
      const isAssigned = ['day', 'evening', 'night', 'charge', 'off'].some(
        (type) => assignments[dateStr][type as ShiftType]?.includes(nurse.id)
      )
      if (isAssigned) return false

      // Skip dedicated roles for wrong shifts
      if (nurse.personalRules.dedicatedRole === 'night' && shiftType !== 'night') return false
      if (nurse.personalRules.dedicatedRole === 'charge' && shiftType !== 'charge') return false

      // Check selected shifts only
      if (nurse.personalRules.selectedShiftsOnly) {
        if (!nurse.personalRules.selectedShiftsOnly.includes(shiftType) && shiftType !== 'charge') {
          return false
        }
      }

      // Check charge eligibility
      if (shiftType === 'charge') {
        if (nurse.yearsOfExperience < settings.chargeSettings.minYearsRequired) {
          return false
        }
      }

      return canAssignShift(nurse, dateStr, shiftType, assignments, settings, allDays)
    })
    .sort((a, b) => {
      const scoreA = nurseScores.get(a.id)!
      const scoreB = nurseScores.get(b.id)!

      // For Charge shifts (non-dedicated): prioritize by charge count first
      if (shiftType === 'charge') {
        const aIsDedicated = a.personalRules.dedicatedRole === 'charge'
        const bIsDedicated = b.personalRules.dedicatedRole === 'charge'

        // Only apply charge count balancing for non-dedicated nurses
        if (!aIsDedicated && !bIsDedicated) {
          if (scoreA.chargeCount !== scoreB.chargeCount) {
            return scoreA.chargeCount - scoreB.chargeCount
          }
        }
      }

      // Continuity bonus: prefer nurses who worked yesterday (minimize 퐁당퐁당 pattern)
      // Nurses who worked yesterday should keep working, nurses who were off should stay off
      const aWorkedYesterday = wasWorkingPreviousDay(a.id, dateStr, assignments)
      const bWorkedYesterday = wasWorkingPreviousDay(b.id, dateStr, assignments)

      if (aWorkedYesterday !== bWorkedYesterday) {
        // Nurse who worked yesterday gets priority (sort first)
        return aWorkedYesterday ? -1 : 1
      }

      // Primary: Lower weighted hours first (fairness)
      // When hours are close (within 2), add randomness for schedule variety
      const hoursDiff = scoreA.weightedHours - scoreB.weightedHours
      if (Math.abs(hoursDiff) > 2) {
        return hoursDiff
      }

      return hoursDiff + (Math.random() - 0.5) * 4
    })
}

function wasWorkingPreviousDay(
  nurseId: string,
  dateStr: string,
  assignments: Record<string, DailyAssignment>
): boolean {
  const currentDate = new Date(dateStr)
  const prevDate = new Date(currentDate)
  prevDate.setDate(prevDate.getDate() - 1)
  const prevDateStr = formatDate(prevDate)

  if (!assignments[prevDateStr]) return false

  return ['day', 'evening', 'night', 'charge'].some(
    (type) => assignments[prevDateStr][type as ShiftType]?.includes(nurseId)
  )
}

function getAvailableNurses(
  nurses: User[],
  dateStr: string,
  assignments: Record<string, DailyAssignment>,
  allDays: Date[]
): User[] {
  return nurses.filter((nurse) => {
    const isAssigned = ['day', 'evening', 'night', 'charge', 'off'].some(
      (type) => assignments[dateStr][type as ShiftType]?.includes(nurse.id)
    )
    return !isAssigned
  })
}


function updateScore(
  nurseScores: Map<string, NurseScore>,
  nurseId: string,
  date: Date,
  shiftType: ShiftType,
  chargeWeight: number,
  holidays: string[]
): void {
  // Off shifts don't count towards weighted hours
  if (shiftType === 'off') return

  const score = nurseScores.get(nurseId)!
  const dateStr = formatDate(date)
  const isWeekendDay = isWeekend(date)
  const isHolidayDay = holidays.includes(dateStr)

  const baseHours = SHIFT_TIMES[shiftType].hours
  let weight = 1.0

  // Cast to WorkShiftType since we already handled 'off' above
  const workShift = shiftType as 'day' | 'evening' | 'night' | 'charge'

  if (isWeekendDay || isHolidayDay) {
    weight = WEIGHTS.weekend[workShift]
  } else {
    weight = WEIGHTS.weekday[workShift]
  }

  // Apply charge weight
  if (shiftType === 'charge') {
    weight *= chargeWeight
    score.chargeCount++
  }

  score.weightedHours += baseHours * weight
}

function calculateTotalHours(
  nurseId: string,
  assignments: Record<string, DailyAssignment>,
  allDays: Date[]
): number {
  let total = 0
  allDays.forEach((date) => {
    const dateStr = formatDate(date)
    const dayAssignment = assignments[dateStr]

    for (const [shiftType, nurseIds] of Object.entries(dayAssignment)) {
      if ((nurseIds as string[]).includes(nurseId)) {
        total += SHIFT_TIMES[shiftType as ShiftType].hours
      }
    }
  })
  return total
}

function calculateShiftCounts(
  nurseId: string,
  assignments: Record<string, DailyAssignment>,
  allDays: Date[]
): Record<ShiftType, number> {
  const counts: Record<ShiftType, number> = { day: 0, evening: 0, night: 0, charge: 0, off: 0 }
  allDays.forEach((date) => {
    const dateStr = formatDate(date)
    const dayAssignment = assignments[dateStr]
    for (const [shiftType, nurseIds] of Object.entries(dayAssignment)) {
      if ((nurseIds as string[]).includes(nurseId)) {
        counts[shiftType as ShiftType]++
      }
    }
  })
  return counts
}
