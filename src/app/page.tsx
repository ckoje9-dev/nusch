'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar, Users, Share2, Clock } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Calendar className="h-8 w-8 text-blue-600" />
            <span className="text-2xl font-bold text-blue-600">NuSch</span>
          </div>
          <div className="flex gap-2">
            <Link href="/login">
              <Button variant="outline">로그인</Button>
            </Link>
            <Link href="/register">
              <Button>시작하기</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
          공평한 간호사 근무표
          <br />
          <span className="text-blue-600">자동으로 생성하세요</span>
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          3교대 근무의 복잡한 규칙을 자동으로 적용하고,
          <br />
          공평한 근무 배치를 보장하는 스마트 근무표 서비스
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/register">
            <Button size="lg" className="text-lg px-8">
              무료로 시작하기
            </Button>
          </Link>
          <Link href="#features">
            <Button size="lg" variant="outline" className="text-lg px-8">
              기능 알아보기
            </Button>
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="container mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">주요 기능</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader>
              <Calendar className="h-10 w-10 text-blue-600 mb-2" />
              <CardTitle>자동 근무표 생성</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                복잡한 규칙을 모두 적용하여 클릭 한번으로 월간 근무표를 자동 생성합니다.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Users className="h-10 w-10 text-blue-600 mb-2" />
              <CardTitle>공평한 배치</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                가중치 시스템으로 주말, 야간 근무를 공평하게 분배하고 통계로 확인합니다.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Share2 className="h-10 w-10 text-blue-600 mb-2" />
              <CardTitle>간편한 공유</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                링크 하나로 팀원들과 근무표를 공유하고, Google Calendar와 연동합니다.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Clock className="h-10 w-10 text-blue-600 mb-2" />
              <CardTitle>근무 교환</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                간호사들끼리 자유롭게 근무를 교환하고, 규칙 위반시 관리자 승인을 받습니다.
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Shift Types Section */}
      <section className="bg-gray-50 py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">5가지 근무 유형 지원</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 max-w-4xl mx-auto">
            <div className="text-center p-4 bg-white rounded-lg shadow">
              <div className="shift-badge shift-day mx-auto mb-2">D</div>
              <h3 className="font-semibold">Day</h3>
              <p className="text-sm text-gray-500">07:00 - 15:30</p>
            </div>
            <div className="text-center p-4 bg-white rounded-lg shadow">
              <div className="shift-badge shift-evening mx-auto mb-2">E</div>
              <h3 className="font-semibold">Evening</h3>
              <p className="text-sm text-gray-500">15:00 - 23:00</p>
            </div>
            <div className="text-center p-4 bg-white rounded-lg shadow">
              <div className="shift-badge shift-night mx-auto mb-2">N</div>
              <h3 className="font-semibold">Night</h3>
              <p className="text-sm text-gray-500">22:30 - 07:30</p>
            </div>
            <div className="text-center p-4 bg-white rounded-lg shadow">
              <div className="shift-badge shift-charge mx-auto mb-2">C</div>
              <h3 className="font-semibold">Charge</h3>
              <p className="text-sm text-gray-500">10:00 - 18:30</p>
            </div>
            <div className="text-center p-4 bg-white rounded-lg shadow">
              <div className="shift-badge shift-off mx-auto mb-2">O</div>
              <h3 className="font-semibold">Off</h3>
              <p className="text-sm text-gray-500">휴무</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h2 className="text-3xl font-bold mb-6">지금 바로 시작하세요</h2>
        <p className="text-gray-600 mb-8">
          복잡한 근무표 작성, NuSch가 대신해드립니다.
        </p>
        <Link href="/register">
          <Button size="lg" className="text-lg px-12">
            무료로 시작하기
          </Button>
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t bg-gray-50 py-8">
        <div className="container mx-auto px-4 text-center text-gray-500">
          <p>&copy; 2026 NuSch. 간호사를 위한 스마트 근무표 서비스.</p>
        </div>
      </footer>
    </div>
  )
}
