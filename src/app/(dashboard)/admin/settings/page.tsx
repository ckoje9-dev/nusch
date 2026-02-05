'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/firebase/auth-context'
import { getOrganization, updateOrganizationSettings } from '@/lib/firebase/firestore'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Save } from 'lucide-react'
import type { OrganizationSettings } from '@/types'

export default function SettingsPage() {
  const { userData } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<OrganizationSettings>({
    simultaneousStaff: { day: 3, evening: 3, night: 2 },
    maxConsecutiveWorkDays: 5,
    maxConsecutiveNightDays: 3,
    monthlyOffDays: 8,
    minRestHours: 8,
    chargeSettings: {
      intensityWeight: 1.2,
      minYearsRequired: 3,
    },
    prohibitNOD: true,
    prohibitEOD: false,
  })

  useEffect(() => {
    async function loadSettings() {
      if (!userData?.organizationId) return

      try {
        const org = await getOrganization(userData.organizationId)
        if (org?.settings) {
          setSettings(org.settings)
        }
      } catch (error) {
        console.error('Failed to load settings:', error)
      } finally {
        setLoading(false)
      }
    }

    loadSettings()
  }, [userData?.organizationId])

  const handleSave = async () => {
    if (!userData?.organizationId) return

    setSaving(true)
    try {
      await updateOrganizationSettings(userData.organizationId, settings)
      toast({
        title: '저장 완료',
        description: '설정이 저장되었습니다.',
      })
    } catch (error) {
      toast({
        title: '저장 실패',
        description: '다시 시도해주세요.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">근무 규칙 설정</h1>
          <p className="text-gray-500">근무표 생성에 적용될 규칙을 설정합니다.</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          저장
        </Button>
      </div>

      {/* 동시 근무자 수 */}
      <Card>
        <CardHeader>
          <CardTitle>동시 근무자 수</CardTitle>
          <CardDescription>각 근무 유형별 필요 인원을 설정합니다.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>Day 근무</Label>
            <Input
              type="number"
              min={1}
              max={20}
              value={settings.simultaneousStaff.day}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  simultaneousStaff: {
                    ...settings.simultaneousStaff,
                    day: parseInt(e.target.value) || 1,
                  },
                })
              }
            />
            <p className="text-xs text-gray-500">07:00 - 15:30</p>
          </div>
          <div className="space-y-2">
            <Label>Evening 근무</Label>
            <Input
              type="number"
              min={1}
              max={20}
              value={settings.simultaneousStaff.evening}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  simultaneousStaff: {
                    ...settings.simultaneousStaff,
                    evening: parseInt(e.target.value) || 1,
                  },
                })
              }
            />
            <p className="text-xs text-gray-500">15:00 - 23:00</p>
          </div>
          <div className="space-y-2">
            <Label>Night 근무</Label>
            <Input
              type="number"
              min={1}
              max={20}
              value={settings.simultaneousStaff.night}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  simultaneousStaff: {
                    ...settings.simultaneousStaff,
                    night: parseInt(e.target.value) || 1,
                  },
                })
              }
            />
            <p className="text-xs text-gray-500">22:30 - 07:30</p>
          </div>
        </CardContent>
      </Card>

      {/* 연속 근무 제한 */}
      <Card>
        <CardHeader>
          <CardTitle>연속 근무 제한</CardTitle>
          <CardDescription>과도한 연속 근무를 방지합니다.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>최대 연속 근무일수</Label>
            <Input
              type="number"
              min={1}
              max={14}
              value={settings.maxConsecutiveWorkDays}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  maxConsecutiveWorkDays: parseInt(e.target.value) || 5,
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>최대 연속 Night 근무일수</Label>
            <Input
              type="number"
              min={1}
              max={7}
              value={settings.maxConsecutiveNightDays}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  maxConsecutiveNightDays: parseInt(e.target.value) || 3,
                })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* 휴무 및 휴식 */}
      <Card>
        <CardHeader>
          <CardTitle>휴무 및 휴식</CardTitle>
          <CardDescription>적절한 휴식을 보장합니다.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>월별 휴무일 수</Label>
            <Input
              type="number"
              min={4}
              max={15}
              value={settings.monthlyOffDays}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  monthlyOffDays: parseInt(e.target.value) || 8,
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>근무 종료 후 최소 휴식시간 (시간)</Label>
            <Input
              type="number"
              min={2}
              max={24}
              value={settings.minRestHours}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  minRestHours: parseInt(e.target.value) || 8,
                })
              }
            />
            <p className="text-xs text-gray-500">최소 2시간 이상</p>
          </div>
        </CardContent>
      </Card>

      {/* Charge 설정 */}
      <Card>
        <CardHeader>
          <CardTitle>Charge 근무 설정</CardTitle>
          <CardDescription>Charge 근무의 조건과 가중치를 설정합니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label>업무 강도 가중치</Label>
              <span className="text-sm font-medium">
                {settings.chargeSettings.intensityWeight.toFixed(1)}
              </span>
            </div>
            <Slider
              value={[settings.chargeSettings.intensityWeight]}
              min={1.0}
              max={1.5}
              step={0.1}
              onValueChange={([value]) =>
                setSettings({
                  ...settings,
                  chargeSettings: {
                    ...settings.chargeSettings,
                    intensityWeight: value,
                  },
                })
              }
            />
            <p className="text-xs text-gray-500">
              1.0 (기본) ~ 1.5 (50% 추가 가중치)
            </p>
          </div>
          <div className="space-y-2">
            <Label>Charge 가능 최소 연차</Label>
            <Input
              type="number"
              min={1}
              max={10}
              value={settings.chargeSettings.minYearsRequired}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  chargeSettings: {
                    ...settings.chargeSettings,
                    minYearsRequired: parseInt(e.target.value) || 3,
                  },
                })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* 금지 패턴 */}
      <Card>
        <CardHeader>
          <CardTitle>근무 패턴 금지</CardTitle>
          <CardDescription>피로도가 높은 근무 패턴을 금지합니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>NOD (Night-Off-Day) 금지</Label>
              <p className="text-xs text-gray-500">
                야간 근무 후 하루 쉬고 바로 주간 근무 배치 금지
              </p>
            </div>
            <Switch
              checked={settings.prohibitNOD}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, prohibitNOD: checked })
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>EOD (Evening-Off-Day) 금지</Label>
              <p className="text-xs text-gray-500">
                저녁 근무 후 하루 쉬고 바로 주간 근무 배치 금지
              </p>
            </div>
            <Switch
              checked={settings.prohibitEOD}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, prohibitEOD: checked })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* 저장 버튼 (모바일) */}
      <div className="lg:hidden">
        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          설정 저장
        </Button>
      </div>
    </div>
  )
}
