import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  Firestore,
} from 'firebase/firestore'
import { db } from './config'
import type {
  Organization,
  User,
  Schedule,
  SwapRequest,
  VacationRequest,
  OrganizationSettings,
} from '@/types'

function getDb(): Firestore {
  if (!db) throw new Error('Firebase not initialized')
  return db
}

// ============ Organizations ============

export async function createOrganization(
  name: string,
  adminId: string,
  settings: OrganizationSettings
): Promise<string> {
  const orgRef = doc(collection(getDb(), 'organizations'))
  const org: Organization = {
    id: orgRef.id,
    name,
    adminId,
    settings,
    shareLink: generateShareLink(),
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  await setDoc(orgRef, {
    ...org,
    createdAt: Timestamp.fromDate(org.createdAt),
    updatedAt: Timestamp.fromDate(org.updatedAt),
  })
  return orgRef.id
}

export async function getOrganization(orgId: string): Promise<Organization | null> {
  const orgDoc = await getDoc(doc(getDb(), 'organizations', orgId))
  if (!orgDoc.exists()) return null
  const data = orgDoc.data()
  return {
    ...data,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
  } as Organization
}

export async function updateOrganizationSettings(
  orgId: string,
  settings: OrganizationSettings
): Promise<void> {
  await updateDoc(doc(getDb(), 'organizations', orgId), {
    settings,
    updatedAt: Timestamp.now(),
  })
}

export async function getOrganizationByShareLink(shareLink: string): Promise<Organization | null> {
  const q = query(collection(getDb(), 'organizations'), where('shareLink', '==', shareLink))
  const snapshot = await getDocs(q)
  if (snapshot.empty) return null
  const data = snapshot.docs[0].data()
  return {
    ...data,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
  } as Organization
}

// ============ Users ============

export async function getUser(userId: string): Promise<User | null> {
  const userDoc = await getDoc(doc(getDb(), 'users', userId))
  if (!userDoc.exists()) return null
  const data = userDoc.data()
  return {
    ...data,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
  } as User
}

export async function getUsersByOrganization(orgId: string): Promise<User[]> {
  const q = query(collection(getDb(), 'users'), where('organizationId', '==', orgId))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((doc) => {
    const data = doc.data()
    return {
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as User
  })
}

export async function updateUser(userId: string, data: Partial<User>): Promise<void> {
  await updateDoc(doc(getDb(), 'users', userId), {
    ...data,
    updatedAt: Timestamp.now(),
  })
}

export async function addNurseToOrganization(
  orgId: string,
  email: string,
  name: string,
  yearsOfExperience: number
): Promise<string> {
  const userRef = doc(collection(getDb(), 'users'))
  const user: User = {
    id: userRef.id,
    organizationId: orgId,
    email,
    name,
    role: 'nurse',
    yearsOfExperience,
    personalRules: {
      vacationDates: [],
      selectedShiftsOnly: null,
      dedicatedRole: null,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  await setDoc(userRef, {
    ...user,
    createdAt: Timestamp.fromDate(user.createdAt),
    updatedAt: Timestamp.fromDate(user.updatedAt),
  })
  return userRef.id
}

export async function deleteUser(userId: string): Promise<void> {
  await deleteDoc(doc(getDb(), 'users', userId))
}

// ============ Schedules ============

export async function createSchedule(schedule: Omit<Schedule, 'id'>): Promise<string> {
  const scheduleRef = doc(collection(getDb(), 'schedules'))
  const newSchedule = {
    ...schedule,
    id: scheduleRef.id,
    createdAt: Timestamp.fromDate(schedule.createdAt),
    updatedAt: Timestamp.fromDate(schedule.updatedAt),
  }
  await setDoc(scheduleRef, newSchedule)
  return scheduleRef.id
}

export async function getSchedule(scheduleId: string): Promise<Schedule | null> {
  const scheduleDoc = await getDoc(doc(getDb(), 'schedules', scheduleId))
  if (!scheduleDoc.exists()) return null
  const data = scheduleDoc.data()
  return {
    ...data,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
  } as Schedule
}

export async function getScheduleByMonth(
  orgId: string,
  yearMonth: string
): Promise<Schedule | null> {
  const q = query(
    collection(getDb(), 'schedules'),
    where('organizationId', '==', orgId),
    where('yearMonth', '==', yearMonth)
  )
  const snapshot = await getDocs(q)
  if (snapshot.empty) return null
  const data = snapshot.docs[0].data()
  return {
    ...data,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
  } as Schedule
}

export async function deleteSchedule(scheduleId: string): Promise<void> {
  await deleteDoc(doc(getDb(), 'schedules', scheduleId))
}

export async function updateSchedule(scheduleId: string, data: Partial<Schedule>): Promise<void> {
  await updateDoc(doc(getDb(), 'schedules', scheduleId), {
    ...data,
    updatedAt: Timestamp.now(),
  })
}

// ============ Swap Requests ============

export async function createSwapRequest(request: Omit<SwapRequest, 'id'>): Promise<string> {
  const requestRef = doc(collection(getDb(), 'swapRequests'))
  await setDoc(requestRef, {
    ...request,
    id: requestRef.id,
    createdAt: Timestamp.fromDate(request.createdAt),
    updatedAt: Timestamp.fromDate(request.updatedAt),
  })
  return requestRef.id
}

export async function getSwapRequestsByUser(userId: string): Promise<SwapRequest[]> {
  const q = query(
    collection(getDb(), 'swapRequests'),
    where('requesterId', '==', userId),
    orderBy('createdAt', 'desc')
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map((doc) => {
    const data = doc.data()
    return {
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as SwapRequest
  })
}

export async function getSwapRequestsForUser(userId: string): Promise<SwapRequest[]> {
  const q = query(
    collection(getDb(), 'swapRequests'),
    where('targetId', '==', userId),
    where('status', '==', 'pending')
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map((doc) => {
    const data = doc.data()
    return {
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as SwapRequest
  })
}

export async function getPendingAdminSwapRequests(orgId: string): Promise<SwapRequest[]> {
  const q = query(
    collection(getDb(), 'swapRequests'),
    where('organizationId', '==', orgId),
    where('status', '==', 'admin_review')
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map((doc) => {
    const data = doc.data()
    return {
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as SwapRequest
  })
}

export async function updateSwapRequest(
  requestId: string,
  status: SwapRequest['status']
): Promise<void> {
  await updateDoc(doc(getDb(), 'swapRequests', requestId), {
    status,
    updatedAt: Timestamp.now(),
  })
}

// ============ Vacation Requests ============

export async function createVacationRequest(
  request: Omit<VacationRequest, 'id'>
): Promise<string> {
  const requestRef = doc(collection(getDb(), 'vacationRequests'))
  await setDoc(requestRef, {
    ...request,
    id: requestRef.id,
    createdAt: Timestamp.fromDate(request.createdAt),
    updatedAt: Timestamp.fromDate(request.updatedAt),
  })
  return requestRef.id
}

export async function getVacationRequestsByUser(userId: string): Promise<VacationRequest[]> {
  const q = query(
    collection(getDb(), 'vacationRequests'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map((doc) => {
    const data = doc.data()
    return {
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as VacationRequest
  })
}

export async function getPendingVacationRequests(orgId: string): Promise<VacationRequest[]> {
  const q = query(
    collection(getDb(), 'vacationRequests'),
    where('organizationId', '==', orgId),
    where('status', '==', 'pending')
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map((doc) => {
    const data = doc.data()
    return {
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as VacationRequest
  })
}

export async function updateVacationRequest(
  requestId: string,
  status: VacationRequest['status']
): Promise<void> {
  await updateDoc(doc(getDb(), 'vacationRequests', requestId), {
    status,
    updatedAt: Timestamp.now(),
  })
}

// ============ Helpers ============

function generateShareLink(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}
