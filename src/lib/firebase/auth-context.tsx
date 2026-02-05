'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import {
  User as FirebaseUser,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db } from './config'
import type { User, UserRole } from '@/types'

interface AuthContextType {
  user: FirebaseUser | null
  userData: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, name: string, role: UserRole, organizationId?: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null)
  const [userData, setUserData] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!auth) {
      setLoading(false)
      return
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)

      if (firebaseUser && db) {
        // Fetch user data from Firestore
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid))
        if (userDoc.exists()) {
          setUserData(userDoc.data() as User)
        }
      } else {
        setUserData(null)
      }

      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    if (!auth) throw new Error('Firebase not initialized')
    await signInWithEmailAndPassword(auth, email, password)
  }

  const signUp = async (
    email: string,
    password: string,
    name: string,
    role: UserRole,
    organizationId?: string
  ) => {
    if (!auth || !db) throw new Error('Firebase not initialized')
    const userCredential = await createUserWithEmailAndPassword(auth, email, password)

    // Create user document in Firestore
    const newUser: User = {
      id: userCredential.user.uid,
      organizationId: organizationId || '',
      email,
      name,
      role,
      yearsOfExperience: 1,
      personalRules: {
        vacationDates: [],
        selectedShiftsOnly: null,
        dedicatedRole: null,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    await setDoc(doc(db, 'users', userCredential.user.uid), newUser)
    setUserData(newUser)
  }

  const signOut = async () => {
    if (!auth) throw new Error('Firebase not initialized')
    await firebaseSignOut(auth)
    setUserData(null)
  }

  return (
    <AuthContext.Provider value={{ user, userData, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
