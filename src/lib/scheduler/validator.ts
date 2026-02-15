import { ShiftType, User, Organization, DailyAssignment } from '@/types'
import { formatDate } from '@/lib/utils'

export interface ValidationResult {
  valid: boolean
  violatedRule?: string
  reason?: string
}

export function validateAssignment(
  nurse: User,
  dateStr: string,
  shiftType: ShiftType,
  assignments: Record<string, DailyAssignment>,
  settings: Organization['settings'],
  allDays: Date[]
): ValidationResult {
  // Check vacation
  if (nurse.personalRules.vacationDates.includes(dateStr)) {
    return {
      valid: false,
      violatedRule: 'vacation',
      reason: '휴가 신청된 날짜입니다.',
    }
  }

  // Check selected shifts only
  if (nurse.personalRules.selectedShiftsOnly) {
    if (!nurse.personalRules.selectedShiftsOnly.includes(shiftType) && shiftType !== 'charge') {
      return {
        valid: false,
        violatedRule: 'selectedShifts',
        reason: '선택 근무제에 해당하지 않는 근무 유형입니다.',
      }
    }
  }

  // Check charge eligibility
  if (shiftType === 'charge') {
    if (nurse.yearsOfExperience < settings.chargeSettings.minYearsRequired) {
      return {
        valid: false,
        violatedRule: 'chargeMinYears',
        reason: `Charge 근무에 필요한 최소 연차(${settings.chargeSettings.minYearsRequired}년)를 충족하지 않습니다.`,
      }
    }
  }

  // Check max consecutive work days
  const consecutiveWorkDays = getConsecutiveWorkDays(nurse.id, dateStr, assignments, allDays)
  if (consecutiveWorkDays >= settings.maxConsecutiveWorkDays) {
    return {
      valid: false,
      violatedRule: 'maxConsecutiveWorkDays',
      reason: `최대 연속 근무일수(${settings.maxConsecutiveWorkDays}일)를 초과합니다.`,
    }
  }

  // Check max consecutive night/charge days
  if (shiftType === 'night' || shiftType === 'charge') {
    const consecutiveDays = getConsecutiveNightChargeDays(nurse.id, dateStr, assignments, allDays)
    if (consecutiveDays >= settings.maxConsecutiveNightDays) {
      return {
        valid: false,
        violatedRule: 'maxConsecutiveNightDays',
        reason: `최대 연속 Night/Charge 근무일수(${settings.maxConsecutiveNightDays}일)를 초과합니다.`,
      }
    }
  }

  // Check forbidden shift transitions
  const restValidation = checkForbiddenTransition(nurse.id, dateStr, shiftType, assignments)
  if (!restValidation.valid) {
    return restValidation
  }

  // Check NOD (Night-Off-Day) prohibition
  if (settings.prohibitNOD && shiftType === 'day') {
    if (isNODPattern(nurse.id, dateStr, assignments, allDays)) {
      return {
        valid: false,
        violatedRule: 'prohibitNOD',
        reason: 'Night-Off-Day 패턴이 금지되어 있습니다.',
      }
    }
  }

  // Check EOD (Evening-Off-Day) prohibition
  if (settings.prohibitEOD && shiftType === 'day') {
    if (isEODPattern(nurse.id, dateStr, assignments, allDays)) {
      return {
        valid: false,
        violatedRule: 'prohibitEOD',
        reason: 'Evening-Off-Day 패턴이 금지되어 있습니다.',
      }
    }
  }

  return { valid: true }
}

function getConsecutiveWorkDays(
  nurseId: string,
  dateStr: string,
  assignments: Record<string, DailyAssignment>,
  allDays: Date[]
): number {
  const currentDate = new Date(dateStr)
  let count = 0

  // Check previous days
  for (let i = 1; i <= 10; i++) {
    const prevDate = new Date(currentDate)
    prevDate.setDate(prevDate.getDate() - i)
    const prevDateStr = formatDate(prevDate)

    if (!assignments[prevDateStr]) break

    const isWorking = ['day', 'evening', 'night', 'charge'].some(
      (type) => assignments[prevDateStr][type as ShiftType]?.includes(nurseId)
    )

    if (isWorking) {
      count++
    } else {
      break
    }
  }

  return count
}

function getConsecutiveNightChargeDays(
  nurseId: string,
  dateStr: string,
  assignments: Record<string, DailyAssignment>,
  allDays: Date[]
): number {
  const currentDate = new Date(dateStr)
  let count = 0

  // Check previous days for Night or Charge shifts
  for (let i = 1; i <= 10; i++) {
    const prevDate = new Date(currentDate)
    prevDate.setDate(prevDate.getDate() - i)
    const prevDateStr = formatDate(prevDate)

    if (!assignments[prevDateStr]) break

    const isNightOrCharge =
      assignments[prevDateStr].night?.includes(nurseId) ||
      assignments[prevDateStr].charge?.includes(nurseId)

    if (isNightOrCharge) {
      count++
    } else {
      break
    }
  }

  return count
}

// Forbidden shift transitions (previous day → next day)
// These patterns don't allow at least 2 time slots of rest
const FORBIDDEN_TRANSITIONS: Record<string, string[]> = {
  // N(22:30-07:30) → D(07:00): 연속 근무 (휴식 없음)
  // N(22:30-07:30) → E(15:00): 1타임 휴식
  // N(22:30-07:30) → C(10:00): 휴식 2.5시간
  night: ['day', 'evening', 'charge'],
  // E(15:00-23:00) → D(07:00): 1타임 휴식
  evening: ['day'],
  // C(10:00-18:30) → N(22:30): 금지 패턴
  charge: ['night'],
}

function checkForbiddenTransition(
  nurseId: string,
  dateStr: string,
  shiftType: ShiftType,
  assignments: Record<string, DailyAssignment>
): ValidationResult {
  const currentDate = new Date(dateStr)
  const prevDate = new Date(currentDate)
  prevDate.setDate(prevDate.getDate() - 1)
  const prevDateStr = formatDate(prevDate)

  if (!assignments[prevDateStr]) {
    return { valid: true }
  }

  // Find previous day's shift
  const prevShiftType = findShiftType(nurseId, prevDateStr, assignments)
  if (!prevShiftType || prevShiftType === 'off') {
    return { valid: true }
  }

  // Check forbidden transition patterns
  const forbidden = FORBIDDEN_TRANSITIONS[prevShiftType]
  if (forbidden && forbidden.includes(shiftType)) {
    return {
      valid: false,
      violatedRule: 'forbiddenTransition',
      reason: `금지된 근무 전환입니다: ${prevShiftType.toUpperCase()} → ${shiftType.toUpperCase()} (최소 2타임 휴식 필요)`,
    }
  }

  return { valid: true }
}

function isNODPattern(
  nurseId: string,
  dateStr: string,
  assignments: Record<string, DailyAssignment>,
  allDays: Date[]
): boolean {
  const currentDate = new Date(dateStr)

  // Check 2 days ago for Night
  const twoDaysAgo = new Date(currentDate)
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
  const twoDaysAgoStr = formatDate(twoDaysAgo)

  // Check 1 day ago for Off
  const oneDayAgo = new Date(currentDate)
  oneDayAgo.setDate(oneDayAgo.getDate() - 1)
  const oneDayAgoStr = formatDate(oneDayAgo)

  if (!assignments[twoDaysAgoStr] || !assignments[oneDayAgoStr]) {
    return false
  }

  const wasNight = assignments[twoDaysAgoStr].night?.includes(nurseId)
  const wasOff = assignments[oneDayAgoStr].off?.includes(nurseId)

  return wasNight && wasOff
}

function isEODPattern(
  nurseId: string,
  dateStr: string,
  assignments: Record<string, DailyAssignment>,
  allDays: Date[]
): boolean {
  const currentDate = new Date(dateStr)

  // Check 2 days ago for Evening
  const twoDaysAgo = new Date(currentDate)
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
  const twoDaysAgoStr = formatDate(twoDaysAgo)

  // Check 1 day ago for Off
  const oneDayAgo = new Date(currentDate)
  oneDayAgo.setDate(oneDayAgo.getDate() - 1)
  const oneDayAgoStr = formatDate(oneDayAgo)

  if (!assignments[twoDaysAgoStr] || !assignments[oneDayAgoStr]) {
    return false
  }

  const wasEvening = assignments[twoDaysAgoStr].evening?.includes(nurseId)
  const wasOff = assignments[oneDayAgoStr].off?.includes(nurseId)

  return wasEvening && wasOff
}

function findShiftType(
  nurseId: string,
  dateStr: string,
  assignments: Record<string, DailyAssignment>
): ShiftType | null {
  if (!assignments[dateStr]) return null

  for (const [type, ids] of Object.entries(assignments[dateStr])) {
    if ((ids as string[]).includes(nurseId)) {
      return type as ShiftType
    }
  }
  return null
}

// Validate swap request
export function validateSwapRequest(
  requester: User,
  target: User,
  requesterShift: { date: string; type: ShiftType },
  targetShift: { date: string; type: ShiftType },
  assignments: Record<string, DailyAssignment>,
  settings: Organization['settings'],
  allDays: Date[]
): { valid: boolean; requiresAdminApproval: boolean; violations: string[] } {
  const violations: string[] = []

  // Temporarily swap and validate
  const tempAssignments = JSON.parse(JSON.stringify(assignments))

  // Remove from original positions
  const requesterIdx = tempAssignments[requesterShift.date][requesterShift.type].indexOf(requester.id)
  const targetIdx = tempAssignments[targetShift.date][targetShift.type].indexOf(target.id)

  if (requesterIdx > -1) tempAssignments[requesterShift.date][requesterShift.type].splice(requesterIdx, 1)
  if (targetIdx > -1) tempAssignments[targetShift.date][targetShift.type].splice(targetIdx, 1)

  // Add to new positions
  tempAssignments[targetShift.date][targetShift.type].push(requester.id)
  tempAssignments[requesterShift.date][requesterShift.type].push(target.id)

  // Validate requester in new position
  const requesterValidation = validateAssignment(
    requester,
    targetShift.date,
    targetShift.type,
    tempAssignments,
    settings,
    allDays
  )
  if (!requesterValidation.valid) {
    violations.push(`${requester.name}: ${requesterValidation.reason}`)
  }

  // Validate target in new position
  const targetValidation = validateAssignment(
    target,
    requesterShift.date,
    requesterShift.type,
    tempAssignments,
    settings,
    allDays
  )
  if (!targetValidation.valid) {
    violations.push(`${target.name}: ${targetValidation.reason}`)
  }

  return {
    valid: violations.length === 0,
    requiresAdminApproval: violations.length > 0,
    violations,
  }
}
