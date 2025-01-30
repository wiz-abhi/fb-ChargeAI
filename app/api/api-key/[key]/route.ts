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

export async function DELETE(req: Request, { params }: { params: { key: string } }) {
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

    const result = await apiKeys.deleteOne({ key: params.key, userId })

    if (result.deletedCount === 0) {
      return new NextResponse(JSON.stringify({ error: "API key not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      })
    }

    return NextResponse.json({ message: "API key deleted successfully" })
  } catch (error) {
    console.error("Failed to delete API key:", error)
    return new NextResponse(JSON.stringify({ error: "Failed to delete API key" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}

