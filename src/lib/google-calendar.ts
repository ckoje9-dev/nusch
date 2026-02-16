import { SHIFT_TIMES } from '@/types'
import type { ShiftType } from '@/types'

// Google Identity Services types
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string
            scope: string
            callback: (response: { access_token?: string; error?: string }) => void
          }) => { requestAccessToken: () => void }
        }
      }
    }
  }
}

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events'
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3'
const EVENT_PREFIX = '[NuSch]'

export interface CalendarEvent {
  date: string // YYYY-MM-DD
  shiftType: ShiftType
  shiftLabel: string
}

/**
 * Request Google Calendar access via OAuth popup
 * Returns an access token or throws an error
 */
export function requestCalendarAccess(): Promise<string> {
  return new Promise((resolve, reject) => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    if (!clientId) {
      reject(new Error('Google Client ID가 설정되지 않았습니다.'))
      return
    }

    if (!window.google?.accounts?.oauth2) {
      reject(new Error('Google 인증 라이브러리가 로드되지 않았습니다.'))
      return
    }

    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: CALENDAR_SCOPE,
      callback: (response) => {
        if (response.error) {
          reject(new Error('Google 인증이 취소되었습니다.'))
          return
        }
        if (response.access_token) {
          resolve(response.access_token)
        } else {
          reject(new Error('액세스 토큰을 받지 못했습니다.'))
        }
      },
    })

    tokenClient.requestAccessToken()
  })
}

/**
 * Delete existing NuSch events in the given time range
 */
async function deleteExistingEvents(
  accessToken: string,
  timeMin: string,
  timeMax: string
): Promise<void> {
  // List existing NuSch events
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    q: EVENT_PREFIX,
    singleEvents: 'true',
    maxResults: '100',
  })

  const listRes = await fetch(
    `${CALENDAR_API}/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (!listRes.ok) return

  const data = await listRes.json()
  const events = data.items || []

  // Delete each NuSch event
  await Promise.all(
    events
      .filter((e: { summary?: string }) => e.summary?.startsWith(EVENT_PREFIX))
      .map((e: { id: string }) =>
        fetch(`${CALENDAR_API}/calendars/primary/events/${e.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${accessToken}` },
        })
      )
  )
}

/**
 * Create calendar events for the given shifts
 */
async function createEvents(
  accessToken: string,
  events: CalendarEvent[]
): Promise<number> {
  let created = 0

  for (const event of events) {
    const [year, month, day] = event.date.split('-').map(Number)
    const times = SHIFT_TIMES[event.shiftType]
    if (!times.start) continue // skip 'off'

    const [startH, startM] = times.start.split(':').map(Number)
    const [endH, endM] = times.end.split(':').map(Number)

    const startDate = new Date(year, month - 1, day, startH, startM)
    const endDate = new Date(year, month - 1, day, endH, endM)

    // Night shift ends next day
    if (event.shiftType === 'night') {
      endDate.setDate(endDate.getDate() + 1)
    }

    const body = {
      summary: `${EVENT_PREFIX} ${event.shiftLabel} 근무`,
      start: {
        dateTime: toLocalISOString(startDate),
        timeZone: 'Asia/Seoul',
      },
      end: {
        dateTime: toLocalISOString(endDate),
        timeZone: 'Asia/Seoul',
      },
      colorId: getColorId(event.shiftType),
    }

    const res = await fetch(`${CALENDAR_API}/calendars/primary/events`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (res.ok) created++
  }

  return created
}

/**
 * Sync nurse schedule to Google Calendar
 * Deletes existing NuSch events for the month, then creates new ones
 */
export async function syncToGoogleCalendar(
  accessToken: string,
  yearMonth: string,
  events: CalendarEvent[]
): Promise<number> {
  const [year, month] = yearMonth.split('-').map(Number)
  const timeMin = new Date(year, month - 1, 1).toISOString()
  const timeMax = new Date(year, month, 0, 23, 59, 59).toISOString()

  // Delete old NuSch events
  await deleteExistingEvents(accessToken, timeMin, timeMax)

  // Create new events
  const created = await createEvents(accessToken, events)
  return created
}

function toLocalISOString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`
}

// Google Calendar color IDs
function getColorId(shiftType: ShiftType): string {
  switch (shiftType) {
    case 'day': return '9'      // Blueberry
    case 'evening': return '5'  // Banana
    case 'night': return '1'    // Lavender
    case 'charge': return '11'  // Tomato
    default: return '8'         // Graphite
  }
}
