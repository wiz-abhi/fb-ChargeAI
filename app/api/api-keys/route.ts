import { NextResponse } from "next/server"
import { getAuth } from "firebase-admin/auth"
import { connectToDatabase } from "@/lib/mongodb"
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

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization")
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

    const db = await connectToDatabase()
    const apiKeys = db.collection("apiKeys")

    const keys = await apiKeys.find({ userId }, { projection: { key: 1, createdAt: 1 } }).toArray()

    console.log("API Keys response:", JSON.stringify(keys))

    return NextResponse.json(keys)
  } catch (error) {
    console.error("Failed to retrieve API keys:", error)
    return NextResponse.json({ error: "Failed to retrieve API keys" }, { status: 500 })
  }
}

