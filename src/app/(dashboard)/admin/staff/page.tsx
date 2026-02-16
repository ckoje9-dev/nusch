'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/lib/firebase/auth-context'
import {
  getUsersByOrganization,
  getUnassignedNurses,
  assignNurseToOrganization,
  updateUser,
  deleteUser,
} from '@/lib/firebase/firestore'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Plus, Pencil, Trash2, User, UserPlus, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { User as UserType, DedicatedRole, ShiftType } from '@/types'

export default function StaffPage() {
  const { userData } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [staff, setStaff] = useState<UserType[]>([])
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editingStaff, setEditingStaff] = useState<UserType | null>(null)

  // Add dialog states
  const [unassignedNurses, setUnassignedNurses] = useState<UserType[]>([])
  const [loadingNurses, setLoadingNurses] = useState(false)
  const [selectedNurseIds, setSelectedNurseIds] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState(false)

  // Edit form states
  const [name, setName] = useState('')
  const [yearsOfExperience, setYearsOfExperience] = useState(1)
  const [dedicatedRole, setDedicatedRole] = useState<DedicatedRole>(null)
  const [selectedShiftsOnly, setSelectedShiftsOnly] = useState<ShiftType[] | null>(null)

  const loadStaff = async () => {
    if (!userData?.organizationId) return

    try {
      const users = await getUsersByOrganization(userData.organizationId)
      setStaff(users.filter((u) => u.role === 'nurse'))
    } catch (error) {
      console.error('Failed to load staff:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStaff()
  }, [userData?.organizationId])

  const loadUnassignedNurses = async () => {
    setLoadingNurses(true)
    try {
      const nurses = await getUnassignedNurses()
      setUnassignedNurses(nurses)
    } catch (error) {
      console.error('Failed to load unassigned nurses:', error)
    } finally {
      setLoadingNurses(false)
    }
  }

  const handleOpenAddDialog = () => {
    setSelectedNurseIds(new Set())
    setAddDialogOpen(true)
    loadUnassignedNurses()
  }

  const toggleNurseSelection = (nurseId: string) => {
    setSelectedNurseIds((prev) => {
      const next = new Set(prev)
      if (next.has(nurseId)) {
        next.delete(nurseId)
      } else {
        next.add(nurseId)
      }
      return next
    })
  }

  const handleAddSelected = async () => {
    if (!userData?.organizationId || selectedNurseIds.size === 0) return

    setAdding(true)
    try {
      await Promise.all(
        Array.from(selectedNurseIds).map((id) =>
          assignNurseToOrganization(id, userData.organizationId)
        )
      )
      toast({
        title: '추가 완료',
        description: `${selectedNurseIds.size}명의 간호사가 추가되었습니다.`,
      })
      setAddDialogOpen(false)
      setSelectedNurseIds(new Set())
      loadStaff()
    } catch (error) {
      toast({
        title: '추가 실패',
        description: '다시 시도해주세요.',
        variant: 'destructive',
      })
    } finally {
      setAdding(false)
    }
  }

  const handleEdit = async () => {
    if (!editingStaff) return

    try {
      await updateUser(editingStaff.id, {
        name,
        yearsOfExperience,
        personalRules: {
          ...editingStaff.personalRules,
          dedicatedRole,
          selectedShiftsOnly,
        },
      })
      toast({
        title: '수정 완료',
        description: '근무자 정보가 수정되었습니다.',
      })
      setEditingStaff(null)
      loadStaff()
    } catch (error) {
      toast({
        title: '수정 실패',
        description: '다시 시도해주세요.',
        variant: 'destructive',
      })
    }
  }

  const handleDelete = async (userId: string, userName: string) => {
    if (!confirm(`${userName} 간호사를 삭제하시겠습니까?`)) return

    try {
      await deleteUser(userId)
      toast({
        title: '삭제 완료',
        description: `${userName} 간호사가 삭제되었습니다.`,
      })
      loadStaff()
    } catch (error) {
      toast({
        title: '삭제 실패',
        description: '다시 시도해주세요.',
        variant: 'destructive',
      })
    }
  }

  const openEditDialog = (staffMember: UserType) => {
    setEditingStaff(staffMember)
    setName(staffMember.name)
    setYearsOfExperience(staffMember.yearsOfExperience)
    setDedicatedRole(staffMember.personalRules.dedicatedRole)
    setSelectedShiftsOnly(staffMember.personalRules.selectedShiftsOnly)
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
          <h1 className="text-2xl font-bold">근무자 관리</h1>
          <p className="text-gray-500">간호사 명단과 개인 규칙을 관리합니다.</p>
        </div>
        <Button onClick={handleOpenAddDialog}>
          <Plus className="h-4 w-4 mr-2" />
          근무자 추가
        </Button>
      </div>

      {/* Add Dialog - Select from registered nurses */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>근무자 추가</DialogTitle>
            <DialogDescription>
              가입된 간호사를 선택하여 우리 부서에 추가합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {loadingNurses ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              </div>
            ) : unassignedNurses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <UserPlus className="h-10 w-10 text-gray-300 mb-3" />
                <p className="text-gray-500 text-sm">
                  소속이 없는 간호사가 없습니다.
                </p>
                <p className="text-gray-400 text-xs mt-1">
                  간호사가 먼저 회원가입을 해야 합니다.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {unassignedNurses.map((nurse) => {
                  const isSelected = selectedNurseIds.has(nurse.id)
                  return (
                    <button
                      key={nurse.id}
                      type="button"
                      onClick={() => toggleNurseSelection(nurse.id)}
                      className={cn(
                        'w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left',
                        isSelected
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      )}
                    >
                      <div
                        className={cn(
                          'h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
                          isSelected
                            ? 'border-blue-500 bg-blue-500'
                            : 'border-gray-300'
                        )}
                      >
                        {isSelected && <Check className="h-3 w-3 text-white" />}
                      </div>
                      <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                        <span className="text-green-600 font-semibold text-sm">
                          {nurse.name.charAt(0)}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm">{nurse.name}</p>
                        <p className="text-xs text-gray-500 truncate">{nurse.email}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              취소
            </Button>
            <Button
              onClick={handleAddSelected}
              disabled={selectedNurseIds.size === 0 || adding}
            >
              {adding && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {selectedNurseIds.size > 0
                ? `${selectedNurseIds.size}명 추가`
                : '추가'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Staff List */}
      {staff.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <User className="h-12 w-12 text-gray-300 mb-4" />
            <p className="text-gray-500">등록된 간호사가 없습니다.</p>
            <Button className="mt-4" onClick={handleOpenAddDialog}>
              <Plus className="h-4 w-4 mr-2" />
              첫 번째 근무자 추가
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {staff.map((member) => (
            <Card key={member.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <span className="text-blue-600 font-semibold">
                      {member.name.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold">{member.name}</p>
                    <p className="text-sm text-gray-500">
                      {member.yearsOfExperience}년차 · {member.email}
                    </p>
                    <div className="flex gap-2 mt-1">
                      {member.personalRules.dedicatedRole === 'night' && (
                        <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded">
                          Night 전담
                        </span>
                      )}
                      {member.personalRules.dedicatedRole === 'charge' && (
                        <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded">
                          Charge 전담
                        </span>
                      )}
                      {member.personalRules.selectedShiftsOnly && (
                        <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded">
                          선택근무제
                        </span>
                      )}
                      {member.personalRules.vacationDates.length > 0 && (
                        <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">
                          휴가 {member.personalRules.vacationDates.length}일
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => openEditDialog(member)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleDelete(member.id, member.name)}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingStaff} onOpenChange={() => setEditingStaff(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>근무자 정보 수정</DialogTitle>
            <DialogDescription>개인 맞춤형 규칙을 설정할 수 있습니다.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>이름</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>연차</Label>
              <Input
                type="number"
                min={1}
                max={30}
                value={yearsOfExperience}
                onChange={(e) => setYearsOfExperience(parseInt(e.target.value) || 1)}
              />
            </div>
            <div className="space-y-2">
              <Label>전담 역할</Label>
              <Select
                value={dedicatedRole || 'none'}
                onValueChange={(v) => setDedicatedRole(v === 'none' ? null : (v as DedicatedRole))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">없음</SelectItem>
                  <SelectItem value="night">Night 전담</SelectItem>
                  <SelectItem value="charge">Charge 전담</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                전담 인원은 공평성 규칙에서 제외됩니다.
              </p>
            </div>
            <div className="space-y-2">
              <Label>선택 근무제</Label>
              <Select
                value={selectedShiftsOnly ? selectedShiftsOnly.join(',') : 'all'}
                onValueChange={(v) => {
                  if (v === 'all') {
                    setSelectedShiftsOnly(null)
                  } else {
                    setSelectedShiftsOnly(v.split(',') as ShiftType[])
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">모든 근무 가능</SelectItem>
                  <SelectItem value="day,evening">Day + Evening만</SelectItem>
                  <SelectItem value="day,night">Day + Night만</SelectItem>
                  <SelectItem value="evening,night">Evening + Night만</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingStaff(null)}>
              취소
            </Button>
            <Button onClick={handleEdit}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Summary */}
      {staff.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>요약</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-blue-600">{staff.length}</p>
                <p className="text-sm text-gray-500">총 인원</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-indigo-600">
                  {staff.filter((s) => s.personalRules.dedicatedRole === 'night').length}
                </p>
                <p className="text-sm text-gray-500">Night 전담</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">
                  {staff.filter((s) => s.personalRules.dedicatedRole === 'charge').length}
                </p>
                <p className="text-sm text-gray-500">Charge 전담</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-600">
                  {(staff.reduce((sum, s) => sum + s.yearsOfExperience, 0) / staff.length).toFixed(1)}
                </p>
                <p className="text-sm text-gray-500">평균 연차</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
