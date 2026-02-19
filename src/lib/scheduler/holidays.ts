import type { Holiday } from '@/types'

// 정적 폴백 데이터 (API 실패 시 사용)
const FALLBACK_HOLIDAYS: Record<string, string> = {
  // 2024
  '2024-01-01': '신정',
  '2024-02-09': '설날 연휴',
  '2024-02-10': '설날',
  '2024-02-11': '설날 연휴',
  '2024-02-12': '대체공휴일',
  '2024-03-01': '삼일절',
  '2024-04-10': '국회의원선거일',
  '2024-05-05': '어린이날',
  '2024-05-06': '대체공휴일',
  '2024-05-15': '부처님오신날',
  '2024-06-06': '현충일',
  '2024-08-15': '광복절',
  '2024-09-16': '추석 연휴',
  '2024-09-17': '추석',
  '2024-09-18': '추석 연휴',
  '2024-10-03': '개천절',
  '2024-10-09': '한글날',
  '2024-12-25': '크리스마스',

  // 2025
  '2025-01-01': '신정',
  '2025-01-28': '설날 연휴',
  '2025-01-29': '설날',
  '2025-01-30': '설날 연휴',
  '2025-03-01': '삼일절',
  '2025-05-05': '어린이날',
  '2025-05-06': '부처님오신날',
  '2025-06-06': '현충일',
  '2025-08-15': '광복절',
  '2025-10-03': '개천절',
  '2025-10-05': '추석 연휴',
  '2025-10-06': '추석',
  '2025-10-07': '추석 연휴',
  '2025-10-08': '대체공휴일',
  '2025-10-09': '한글날',
  '2025-12-25': '크리스마스',

  // 2026
  '2026-01-01': '신정',
  '2026-02-16': '설날 연휴',
  '2026-02-17': '설날',
  '2026-02-18': '설날 연휴',
  '2026-03-01': '삼일절',
  '2026-03-02': '대체공휴일',
  '2026-05-05': '어린이날',
  '2026-05-24': '부처님오신날',
  '2026-05-25': '대체공휴일',
  '2026-06-06': '현충일',
  '2026-08-15': '광복절',
  '2026-08-17': '대체공휴일',
  '2026-09-24': '추석 연휴',
  '2026-09-25': '추석',
  '2026-09-26': '추석 연휴',
  '2026-10-03': '개천절',
  '2026-10-05': '대체공휴일',
  '2026-10-09': '한글날',
  '2026-12-25': '크리스마스',
}

// 연도별 API 캐시 (세션 중 반복 요청 방지)
const holidayCache: Record<number, Record<string, string>> = {}

/**
 * API로 특정 연도의 한국 공휴일을 가져옴
 * 실패 시 정적 폴백 데이터 사용
 */
export async function fetchHolidaysByYear(year: number): Promise<Record<string, string>> {
  if (holidayCache[year]) return holidayCache[year]

  try {
    const res = await fetch(`/api/holidays?year=${year}`)
    if (!res.ok) throw new Error('API error')
    const data: Record<string, string> = await res.json()
    if (Object.keys(data).length === 0) throw new Error('Empty response')
    holidayCache[year] = data
    return data
  } catch {
    // 폴백: 정적 데이터에서 해당 연도 필터링
    const fallback: Record<string, string> = {}
    for (const [date, name] of Object.entries(FALLBACK_HOLIDAYS)) {
      if (date.startsWith(String(year))) fallback[date] = name
    }
    holidayCache[year] = fallback
    return fallback
  }
}

/**
 * 특정 월의 공휴일 목록 반환 (holidayMap에서 필터링)
 */
export function getHolidaysInMonthFromMap(
  holidayMap: Record<string, string>,
  year: number,
  month: number
): Holiday[] {
  const monthStr = `${year}-${String(month).padStart(2, '0')}`
  return Object.entries(holidayMap)
    .filter(([date]) => date.startsWith(monthStr))
    .map(([date, name]) => ({ date, name }))
}

// 하위 호환 - 정적 데이터 기반 동기 함수 (스케줄러 폴백용)
export function getHolidaysInMonth(year: number, month: number): Holiday[] {
  const monthStr = `${year}-${String(month).padStart(2, '0')}`
  return Object.entries(FALLBACK_HOLIDAYS)
    .filter(([date]) => date.startsWith(monthStr))
    .map(([date, name]) => ({ date, name }))
}
