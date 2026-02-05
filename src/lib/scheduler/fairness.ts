interface NurseScore {
  userId: string
  weightedHours: number
  chargeCount: number
  yearsOfExperience: number
}

/**
 * 공평성 점수 계산 (0-100)
 * 100에 가까울수록 평균에 가까운 공평한 배치
 */
export function calculateFairnessScore(
  individualWeightedHours: number,
  allNurseScores: Map<string, NurseScore>
): number {
  const scores = Array.from(allNurseScores.values())
  if (scores.length === 0) return 100

  const avgWeightedHours =
    scores.reduce((sum, s) => sum + s.weightedHours, 0) / scores.length

  if (avgWeightedHours === 0) return 100

  // Calculate standard deviation
  const variance =
    scores.reduce((sum, s) => sum + Math.pow(s.weightedHours - avgWeightedHours, 2), 0) /
    scores.length
  const stdDev = Math.sqrt(variance)

  if (stdDev === 0) return 100

  // Z-score 기반 점수 계산
  const zScore = Math.abs(individualWeightedHours - avgWeightedHours) / stdDev

  // Z-score를 0-100 점수로 변환 (z-score가 0이면 100점, 2 이상이면 0점)
  const fairnessScore = Math.max(0, Math.min(100, 100 - zScore * 50))

  return Math.round(fairnessScore * 10) / 10
}

/**
 * 전체 근무표의 공평성 지표 계산
 */
export function calculateOverallFairness(
  statistics: Record<string, { weightedHours: number }>
): {
  average: number
  stdDev: number
  min: number
  max: number
  fairnessIndex: number // 0-100, 높을수록 공평
} {
  const hours = Object.values(statistics).map((s) => s.weightedHours)

  if (hours.length === 0) {
    return {
      average: 0,
      stdDev: 0,
      min: 0,
      max: 0,
      fairnessIndex: 100,
    }
  }

  const average = hours.reduce((a, b) => a + b, 0) / hours.length
  const variance = hours.reduce((sum, h) => sum + Math.pow(h - average, 2), 0) / hours.length
  const stdDev = Math.sqrt(variance)
  const min = Math.min(...hours)
  const max = Math.max(...hours)

  // Coefficient of Variation을 기반으로 공평성 지수 계산
  // CV가 0이면 완벽한 공평 (100점), CV가 높을수록 불공평
  const cv = average > 0 ? (stdDev / average) * 100 : 0
  const fairnessIndex = Math.max(0, Math.min(100, 100 - cv * 5))

  return {
    average: Math.round(average * 10) / 10,
    stdDev: Math.round(stdDev * 10) / 10,
    min: Math.round(min * 10) / 10,
    max: Math.round(max * 10) / 10,
    fairnessIndex: Math.round(fairnessIndex * 10) / 10,
  }
}

/**
 * 근무자별 공평성 순위 계산
 */
export function rankByFairness(
  statistics: Record<string, { weightedHours: number; fairnessScore: number }>
): { userId: string; rank: number; weightedHours: number; fairnessScore: number }[] {
  const entries = Object.entries(statistics).map(([userId, stats]) => ({
    userId,
    weightedHours: stats.weightedHours,
    fairnessScore: stats.fairnessScore,
    rank: 0,
  }))

  // Sort by fairness score descending (higher is better)
  entries.sort((a, b) => b.fairnessScore - a.fairnessScore)

  // Assign ranks
  entries.forEach((entry, index) => {
    entry.rank = index + 1
  })

  return entries
}

/**
 * Charge 근무 분포 분석
 */
export function analyzeChargeDistribution(
  statistics: Record<string, { chargeCount: number }>
): {
  average: number
  stdDev: number
  isBalanced: boolean // 표준편차가 평균의 30% 이내면 balanced
} {
  const counts = Object.values(statistics).map((s) => s.chargeCount)

  if (counts.length === 0) {
    return { average: 0, stdDev: 0, isBalanced: true }
  }

  const average = counts.reduce((a, b) => a + b, 0) / counts.length
  const variance = counts.reduce((sum, c) => sum + Math.pow(c - average, 2), 0) / counts.length
  const stdDev = Math.sqrt(variance)

  const isBalanced = average === 0 || stdDev / average <= 0.3

  return {
    average: Math.round(average * 10) / 10,
    stdDev: Math.round(stdDev * 10) / 10,
    isBalanced,
  }
}
