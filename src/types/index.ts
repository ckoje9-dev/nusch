// 근무 유형
export type ShiftType = 'day' | 'evening' | 'night' | 'charge' | 'off';

// 근무 시간 정보
export const SHIFT_TIMES: Record<ShiftType, { start: string; end: string; hours: number }> = {
  day: { start: '07:00', end: '15:30', hours: 8.5 },
  evening: { start: '15:00', end: '23:00', hours: 8 },
  night: { start: '22:30', end: '07:30', hours: 9 },
  charge: { start: '10:00', end: '18:30', hours: 8.5 },
  off: { start: '', end: '', hours: 0 },
};

// 근무 유형 한글 라벨
export const SHIFT_LABELS: Record<ShiftType, string> = {
  day: 'Day',
  evening: 'Evening',
  night: 'Night',
  charge: 'Charge',
  off: 'Off',
};

// 사용자 역할
export type UserRole = 'admin' | 'nurse';

// 전담 역할
export type DedicatedRole = 'night' | 'charge' | null;

// 근무 유형 (off 제외) - 가중치 적용 대상
export type WorkShiftType = 'day' | 'evening' | 'night' | 'charge';

// 가중치 시스템
export const WEIGHTS: {
  weekday: Record<WorkShiftType, number>;
  weekend: Record<WorkShiftType, number>;
  holiday: Record<WorkShiftType, number>;
} = {
  weekday: { day: 1.0, evening: 1.0, night: 1.5, charge: 1.0 },
  weekend: { day: 1.5, evening: 1.5, night: 2.0, charge: 1.5 },
  holiday: { day: 1.5, evening: 1.5, night: 2.0, charge: 1.5 },
};

// 조직 설정
export interface OrganizationSettings {
  simultaneousStaff: {
    day: number;
    evening: number;
    night: number;
  };
  maxConsecutiveWorkDays: number;
  maxConsecutiveNightDays: number;
  monthlyOffDays: number;
  chargeSettings: {
    intensityWeight: number; // 1.0 ~ 1.5
    minYearsRequired: number;
  };
  prohibitNOD: boolean; // Night-Off-Day 금지
  prohibitEOD: boolean; // Evening-Off-Day 금지
}

// 조직
export interface Organization {
  id: string;
  name: string;
  adminId: string;
  settings: OrganizationSettings;
  shareLink: string;
  createdAt: Date;
  updatedAt: Date;
}

// 개인 맞춤형 규칙
export interface PersonalRules {
  vacationDates: string[]; // YYYY-MM-DD 형식
  selectedShiftsOnly: ShiftType[] | null; // null이면 모든 근무 가능
  dedicatedRole: DedicatedRole;
}

// 사용자
export interface User {
  id: string;
  organizationId: string;
  email: string;
  name: string;
  role: UserRole;
  yearsOfExperience: number;
  personalRules: PersonalRules;
  createdAt: Date;
  updatedAt: Date;
}

// 일별 근무 배정
export interface DailyAssignment {
  day: string[];      // userId[]
  evening: string[];
  night: string[];
  charge: string[];
  off: string[];
}

// 개인 통계
export interface UserStatistics {
  totalHours: number;
  weightedHours: number;
  chargeCount: number;
  fairnessScore: number;
}

// 규칙 위반 기록
export interface Violation {
  userId: string;
  date: string;
  rule: string;
  reason: string;
}

// 월별 근무표
export interface Schedule {
  id: string;
  organizationId: string;
  yearMonth: string; // "2026-02"
  assignments: Record<string, DailyAssignment>; // key: YYYY-MM-DD
  statistics: Record<string, UserStatistics>; // key: userId
  violations: Violation[];
  status: 'draft' | 'published';
  createdAt: Date;
  updatedAt: Date;
}

// 근무 교환 요청
export interface SwapRequest {
  id: string;
  organizationId: string;
  requesterId: string;
  targetId: string;
  requesterShift: {
    date: string;
    type: ShiftType;
  };
  targetShift: {
    date: string;
    type: ShiftType;
  };
  status: 'pending' | 'approved' | 'rejected' | 'admin_review';
  requiresAdminApproval: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// 휴가 요청
export interface VacationRequest {
  id: string;
  organizationId: string;
  userId: string;
  dates: string[]; // YYYY-MM-DD[]
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
}

// 알림
export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'swap_request' | 'swap_approved' | 'swap_rejected' | 'vacation_approved' | 'vacation_rejected' | 'schedule_published';
  read: boolean;
  createdAt: Date;
}

// 공휴일 (한국)
export interface Holiday {
  date: string; // YYYY-MM-DD
  name: string;
}
