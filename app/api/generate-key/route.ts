import { NextResponse } from "next/server"
import { getAuth } from "firebase-admin/auth"
import { connectToDatabase } from "@/lib/mongodb"
import crypto from "crypto"
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

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    }

    const token = authHeader.split("Bearer ")[1]
    let decodedToken
    try {
      decodedToken = await getAuth().verifyIdToken(token)
    } catch (error) {
      console.error("Error verifying Firebase ID token:", error)
      return new NextResponse(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    }

    const userId = decodedToken.uid

    const db = await connectToDatabase()
    const apiKeys = db.collection("apiKeys")

    const existingKeys = await apiKeys.find({ userId }).toArray()
    if (existingKeys.length >= 2) {
      return new NextResponse(JSON.stringify({ error: "Maximum number of API keys reached" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    const key = crypto.randomBytes(32).toString("hex")
    await apiKeys.insertOne({ key, userId, createdAt: new Date() })

    return NextResponse.json({ apiKey: key })
  } catch (error) {
    console.error("Failed to generate API key:", error)
    return new NextResponse(JSON.stringify({ error: "Failed to generate API key" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}

