"use client"

import { Inter } from "next/font/google"
import { useEffect } from "react"
import { initializeApp } from "firebase/app"
import { getAuth } from "firebase/auth"
import Navbar from "@/components/Navbar"
import "./globals.css"
import type React from "react" // Added import for React

const inter = Inter({ subsets: ["latin"] })

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

function FirebaseInitializer() {
  useEffect(() => {
    const app = initializeApp(firebaseConfig)
    getAuth(app)
  }, [])

  return null
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <FirebaseInitializer />
        <Navbar />
        {children}
        <footer className="bg-gray-800 text-white text-center py-2 mt-8">
            <p>&copy; {new Date().getFullYear()} Created by Abhishek</p>
          </footer>
      </body>
    </html>
  )
}

