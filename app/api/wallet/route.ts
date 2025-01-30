import { NextResponse } from "next/server"
import { getAuth } from "firebase-admin/auth"
import { getWallet, createWallet } from "@/lib/mongodb"
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

    let wallet = await getWallet(userId)
    if (!wallet) {
      wallet = await createWallet(userId)
    }

    console.log("Wallet response:", JSON.stringify(wallet))
    return NextResponse.json(wallet)
  } catch (error) {
    console.error("Failed to retrieve wallet:", error)
    return NextResponse.json({ error: "Failed to retrieve wallet" }, { status: 500 })
  }
}

