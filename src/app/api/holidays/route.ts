import { NextRequest, NextResponse } from 'next/server'

interface NagerHoliday {
  date: string
  localName: string
  name: string
}

export async function GET(request: NextRequest) {
  const year = request.nextUrl.searchParams.get('year')
  if (!year) {
    return NextResponse.json({ error: 'year parameter required' }, { status: 400 })
  }

  try {
    const res = await fetch(
      `https://date.nager.at/api/v3/PublicHolidays/${year}/KR`,
      {
        next: { revalidate: 60 * 60 * 24 * 30 }, // 30일 캐싱
      }
    )

    if (!res.ok) {
      throw new Error(`Nager API error: ${res.status}`)
    }

    const data: NagerHoliday[] = await res.json()

    // { "2026-01-01": "신정", ... } 형태로 변환
    const holidays: Record<string, string> = {}
    for (const h of data) {
      holidays[h.date] = h.localName
    }

    return NextResponse.json(holidays, {
      headers: { 'Cache-Control': 'public, max-age=2592000' }, // 브라우저도 30일 캐싱
    })
  } catch (error) {
    console.error('Failed to fetch holidays:', error)
    return NextResponse.json({}, { status: 500 })
  }
}
