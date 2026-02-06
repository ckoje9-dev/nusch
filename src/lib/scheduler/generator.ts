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
import { isHoliday } from './holidays'
import { validateAssignment, ValidationResult } from './validator'
import { calculateFairnessScore } from './fairness'

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

export function generateSchedule(ctx: SchedulerContext): Schedule {
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

  // Calculate median years of experience
  const medianYears = calculateMedianYears(nurses)

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

  // Step 2: Assign Night-dedicated nurses first
  const nightDedicated = nurses.filter((n) => n.personalRules.dedicatedRole === 'night')
  const chargeDedicated = nurses.filter((n) => n.personalRules.dedicatedRole === 'charge')

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
        nurseScores,
        medianYears
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
        // Try to assign with relaxed rules (record violations)
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
  const statistics: Record<string, UserStatistics> = {}
  nurses.forEach((nurse) => {
    const score = nurseScores.get(nurse.id)!
    const totalHours = calculateTotalHours(nurse.id, assignments, days)
    statistics[nurse.id] = {
      totalHours,
      weightedHours: score.weightedHours,
      chargeCount: score.chargeCount,
      fairnessScore: calculateFairnessScore(score.weightedHours, nurseScores),
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
  nurseScores: Map<string, NurseScore>,
  medianYears: number
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

      // Primary: Lower weighted hours first (fairness)
      if (scoreA.weightedHours !== scoreB.weightedHours) {
        return scoreA.weightedHours - scoreB.weightedHours
      }

      // Secondary: Balance years of experience towards median
      const currentAssigned = getCurrentDayAssigned(dateStr, shiftType, assignments, nurses)
      const avgYearsWithA = calculateAvgYears([...currentAssigned, a])
      const avgYearsWithB = calculateAvgYears([...currentAssigned, b])
      const diffA = Math.abs(avgYearsWithA - medianYears)
      const diffB = Math.abs(avgYearsWithB - medianYears)

      return diffA - diffB
    })
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

function getCurrentDayAssigned(
  dateStr: string,
  shiftType: ShiftType,
  assignments: Record<string, DailyAssignment>,
  nurses: User[]
): User[] {
  const assignedIds = assignments[dateStr][shiftType] || []
  return nurses.filter((n) => assignedIds.includes(n.id))
}

function calculateAvgYears(nurses: User[]): number {
  if (nurses.length === 0) return 0
  return nurses.reduce((sum, n) => sum + n.yearsOfExperience, 0) / nurses.length
}

function calculateMedianYears(nurses: User[]): number {
  if (nurses.length === 0) return 0
  const sorted = [...nurses].sort((a, b) => a.yearsOfExperience - b.yearsOfExperience)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1].yearsOfExperience + sorted[mid].yearsOfExperience) / 2
  }
  return sorted[mid].yearsOfExperience
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
