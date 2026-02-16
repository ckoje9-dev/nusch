# 간호사 가입 플로우 변경 계획

## 개요
회원가입 시 관리자/간호사 역할을 선택하고, 관리자가 근무자 추가 시 기존 가입된 간호사 계정을 검색하여 조직에 추가하는 방식으로 변경

## 변경 사항

### 1. 회원가입 페이지 수정 (`src/app/(auth)/register/page.tsx`)
- 첫 번째 스텝에 **역할 선택** 추가 (관리자 / 간호사)
- 관리자 선택 시: 기존 플로우 (2단계 → 병원 이름 입력)
- 간호사 선택 시: 1단계만 (이메일, 이름, 비밀번호) → 가입 완료 후 `/nurse/schedule`로 이동
  - `organizationId`는 빈 문자열로 생성 (아직 소속 없음)

### 2. 근무자 관리 페이지 수정 (`src/app/(dashboard)/admin/staff/page.tsx`)
- 기존 "근무자 추가" 다이얼로그 → **가입된 간호사 검색/선택** 방식으로 변경
- 다이얼로그 내용:
  - 소속이 없는(organizationId === '') 간호사 계정 목록 표시
  - 체크박스로 선택 → "추가" 버튼 → 해당 간호사의 organizationId를 현재 조직으로 업데이트
- 기존 수동 입력(이름, 이메일, 연차) 제거

### 3. Firestore 함수 추가 (`src/lib/firebase/firestore.ts`)
- `getUnassignedNurses()`: `role === 'nurse' && organizationId === ''`인 유저 목록 조회
- 기존 `addNurseToOrganization()` → `assignNurseToOrganization(userId, orgId)`로 변경 (기존 유저의 organizationId 업데이트)

### 4. 로그인 페이지 (`src/app/(auth)/login/page.tsx`)
- 이미 역할 기반 라우팅 적용됨 (변경 없음)

### 5. 대시보드 레이아웃 (`src/app/(dashboard)/layout.tsx`)
- 간호사가 소속이 없는 경우(organizationId === '') → "소속이 없습니다" 안내 표시

### 6. 정리
- `/join/[id]/page.tsx` 삭제 (더 이상 불필요)
- `/share/[id]/page.tsx`에서 "간호사로 가입하기" 버튼 제거
