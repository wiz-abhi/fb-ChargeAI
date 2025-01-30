import { NextResponse } from "next/server"
import { getAuth } from "firebase-admin/auth"
import { getTransactions } from "@/lib/mongodb"
import { initializeApp, getApps, cert } from "firebase-admin/app"

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
    }),
  })
}

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const token = authHeader.split("Bearer ")[1]
    let decodedToken
    try {
      decodedToken = await getAuth().verifyIdToken(token)
    } catch (error) {
      console.error("Error verifying Firebase ID token:", error)
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    const userId = decodedToken.uid

    const url = new URL(request.url)
    const page = Number.parseInt(url.searchParams.get("page") || "1", 10)
    const limit = Number.parseInt(url.searchParams.get("limit") || "10", 10)

    const { transactions, totalCount } = await getTransactions(userId, page, limit)

    return NextResponse.json({ transactions, totalCount, page, limit })
  } catch (error) {
    console.error("Failed to retrieve transactions:", error)
    return NextResponse.json({ error: "Failed to retrieve transactions" }, { status: 500 })
  }
}

