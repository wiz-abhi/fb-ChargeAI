"use client"

import { useEffect, useState } from "react"
import { getAuth, onAuthStateChanged } from "firebase/auth"
import { useRouter } from "next/navigation"
import type React from "react" // Added import for React

export function withAuth(Component: React.ComponentType) {
  return function AuthenticatedComponent(props: any) {
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const router = useRouter()

    useEffect(() => {
      const auth = getAuth()
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user) {
          setIsAuthenticated(true)
        } else {
          setIsAuthenticated(false)
          router.push("/")
        }
      })

      return () => unsubscribe()
    }, [router])

    if (!isAuthenticated) {
      return <div>Loading...</div>
    }

    return <Component {...props} />
  }
}

