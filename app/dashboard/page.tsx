"use client"

import { withAuth } from "../auth"
import DashboardClient from "./client"

function DashboardPage() {
  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8 text-center text-gray-900">Dashboard</h1>
      <DashboardClient />
    </div>
  )
}

export default withAuth(DashboardPage)

