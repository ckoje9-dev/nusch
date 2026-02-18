/**
 * 테스트 간호사 계정 일괄 생성 스크립트
 *
 * 사용법:
 *   node scripts/seed-test-users.cjs
 *
 * 실행 전 필요:
 *   1. Firebase Console → 프로젝트 설정 → 서비스 계정 → "새 비공개 키 생성"
 *   2. 다운로드한 JSON 파일을 프로젝트 루트에 service-account.json 으로 저장
 *   3. 아래 ORG_ID를 본인의 organizationId로 변경
 */

const admin = require('firebase-admin')
const path = require('path')

// ============ 설정 ============
const ORG_ID = 'v9vsEWeFRFV0iBjBQi06'
const PASSWORD = '123456'

const TEST_NURSES = [
  { name: '김서연', email: 'nurse1@test.com', years: 1 },
  { name: '이지은', email: 'nurse2@test.com', years: 1 },
  { name: '박하늘', email: 'nurse3@test.com', years: 1 },
  { name: '최유진', email: 'nurse4@test.com', years: 1 },
  { name: '정다은', email: 'nurse5@test.com', years: 1 },
  { name: '한소희', email: 'nurse6@test.com', years: 1 },
  { name: '윤서아', email: 'nurse7@test.com', years: 1 },
  { name: '강민지', email: 'nurse8@test.com', years: 1 },
  { name: '임수빈', email: 'nurse9@test.com', years: 2 },
  { name: '오예린', email: 'nurse10@test.com', years: 2 },
  { name: '조아라', email: 'nurse11@test.com', years: 2 },
  { name: '박주원', email: 'nurse12@test.com', years: 2 },
  { name: '임지수', email: 'nurse13@test.com', years: 2 },
  { name: '양승연', email: 'nurse14@test.com', years: 2 },
  { name: '윤소영', email: 'nurse15@test.com', years: 2 },
  { name: '이혜린', email: 'nurse16@test.com', years: 2 },
  { name: '강소라', email: 'nurse17@test.com', years: 2 },
]
// ==============================

const serviceAccountPath = path.join(__dirname, '..', 'service-account.json')

admin.initializeApp({
  credential: admin.credential.cert(serviceAccountPath),
})

const db = admin.firestore()

async function createTestUser(nurse) {
  try {
    const userRecord = await admin.auth().createUser({
      email: nurse.email,
      password: PASSWORD,
      displayName: nurse.name,
    })

    await db.doc(`users/${userRecord.uid}`).set({
      id: userRecord.uid,
      organizationId: ORG_ID,
      email: nurse.email,
      name: nurse.name,
      role: 'nurse',
      yearsOfExperience: nurse.years,
      personalRules: {
        vacationDates: [],
        selectedShiftsOnly: null,
        dedicatedRole: null,
      },
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
    })

    console.log(`  [OK] ${nurse.name} (${nurse.email}) - uid: ${userRecord.uid}`)
    return true
  } catch (error) {
    if (error.code === 'auth/email-already-exists') {
      console.log(`  [SKIP] ${nurse.name} (${nurse.email}) - 이미 존재`)
    } else {
      console.error(`  [FAIL] ${nurse.name} (${nurse.email}) -`, error.message)
    }
    return false
  }
}

async function main() {
  console.log(`\n테스트 간호사 계정 생성`)
  console.log(`조직 ID: ${ORG_ID}`)
  console.log(`비밀번호: ${PASSWORD}`)
  console.log(`생성 인원: ${TEST_NURSES.length}명\n`)

  let created = 0
  for (const nurse of TEST_NURSES) {
    const ok = await createTestUser(nurse)
    if (ok) created++
  }

  console.log(`\n완료: ${created}/${TEST_NURSES.length}명 생성`)
  console.log(`로그인: nurse1@test.com ~ nurse17@test.com / 비밀번호 ${PASSWORD}\n`)
  process.exit(0)
}

main()
