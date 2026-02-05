# NuSch - 간호사 근무표 자동 생성 서비스

3교대 간호사를 위한 공평한 근무표 자동 생성 웹 서비스입니다.

## 주요 기능

### 관리자 (수간호사)
- 근무 규칙 설정 (동시 근무자 수, 연속 근무 제한, 휴식 시간 등)
- 근무자 관리 (이름, 연차, 개인 맞춤형 규칙)
- 근무표 자동 생성 및 공평성 통계 확인
- 결재 관리 (휴가 신청, 근무 교환)
- 링크로 근무표 공유

### 간호사
- 내 근무표 조회
- Google Calendar 내보내기
- 동료와 근무 교환
- 휴가 신청

## 근무 유형

| 유형 | 시간 |
|------|------|
| Day | 07:00 - 15:30 |
| Evening | 15:00 - 23:00 |
| Night | 22:30 - 07:30 |
| Charge | 10:00 - 18:30 |
| Off | 휴무 |

## 공평성 시스템

가중치를 적용하여 근무 배분의 공평성을 확보합니다:

- 토/일/공휴일 Night: 2.0
- 토/일/공휴일 Day, Evening + 평일 Night: 1.5
- 평일 Day, Evening: 1.0

Charge 근무는 별도의 업무 강도 가중치(1.0~1.5)가 적용됩니다.

## 기술 스택

- **Frontend**: Next.js 14 + TypeScript + Tailwind CSS
- **Backend**: Firebase (Auth, Firestore)
- **Hosting**: Firebase Hosting

## 설치 및 실행

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

`.env.local.example`을 `.env.local`로 복사하고 Firebase 설정을 입력합니다:

```bash
cp .env.local.example .env.local
```

### 3. Firebase 프로젝트 설정

1. [Firebase Console](https://console.firebase.google.com)에서 프로젝트 생성
2. Authentication 활성화 (이메일/비밀번호)
3. Firestore Database 생성
4. 웹 앱 추가 및 SDK 설정 복사

### 4. 개발 서버 실행

```bash
npm run dev
```

http://localhost:3000 에서 확인할 수 있습니다.

## 배포

### Firebase Hosting

```bash
npm run build
firebase deploy
```

## Firestore 보안 규칙

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == userId ||
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    // Organizations
    match /organizations/{orgId} {
      allow read: if true;
      allow write: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    // Schedules
    match /schedules/{scheduleId} {
      allow read: if true;
      allow write: if request.auth != null;
    }

    // Swap Requests
    match /swapRequests/{requestId} {
      allow read, write: if request.auth != null;
    }

    // Vacation Requests
    match /vacationRequests/{requestId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## 라이선스

MIT
