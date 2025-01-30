"use client"

import { useState, useEffect } from "react"
import useSWR, { mutate } from "swr"
import { getAuth, type User } from "firebase/auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Key, Trash2, AlertCircle } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import {HelpCircle, Copy, Check } from "lucide-react"

const fetcher = async (url: string) => {
  const auth = getAuth()
  const token = await auth.currentUser?.getIdToken()
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || "An error occurred while fetching the data.")
  }
  return res.json()
}

interface Transaction {
  _id: string
  type: string
  amount: number
  description: string
  timestamp: string
  userId: string
}

interface Wallet {
  balance: number
}

interface ApiKey {
  _id: string
  key: string
  createdAt: string
}

interface DashboardClientProps {
  initialWallet: Wallet | null
  initialTransactions: Transaction[]
  initialTotalCount: number
  codeSnippet: string
}


export default function DashboardClient({
  initialWallet,
  initialTransactions = [], // Add default value
  initialTotalCount = 0,
  codeSnippet,   
}: DashboardClientProps) {
  const [user, setUser] = useState<User | null>(null)
  const [page, setPage] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const auth = getAuth()
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user)
    })

    return () => unsubscribe()
  }, [])

  const { data: wallet, error: walletError } = useSWR<Wallet>(
    user ? "/api/wallet" : null,
    fetcher,
    {
      fallbackData: initialWallet,
      revalidateOnFocus: false
    }
  )

  const { data: apiKeysData = [], error: apiKeysError } = useSWR<ApiKey[]>( // Add default empty array
    user ? "/api/api-keys" : null,
    fetcher,
    {
      revalidateOnFocus: false
    }
  )

  const { data: transactionsData, error: transactionsError } = useSWR<{
    transactions: Transaction[]
    totalCount: number
    page: number
    limit: number
  }>(
    user ? `/api/transactions?page=${page}&limit=10` : null,
    fetcher,
    {
      fallbackData: { 
        transactions: initialTransactions, 
        totalCount: initialTotalCount,
        page: 1,
        limit: 10
      },
      keepPreviousData: true,
      revalidateOnFocus: false
    }
  )
  const handleCopyClick = async () => {
    console.log('Copy button clicked'); // Log to verify it's triggered
    try {
      await navigator.clipboard.writeText(codeSnippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };
  

  const generateApiKey = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const auth = getAuth()
      const token = await auth.currentUser?.getIdToken()
      const response = await fetch("/api/generate-key", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to generate API key")
      }
      await mutate("/api/api-keys")
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsLoading(false)
    }
  }

  const deleteApiKey = async (key: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const auth = getAuth()
      const token = await auth.currentUser?.getIdToken()
      const response = await fetch(`/api/api-key/${key}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to delete API key")
      }
      await mutate("/api/api-keys")
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsLoading(false)
    }
  }


  if (!user) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Please sign in to view the dashboard.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (walletError || apiKeysError || transactionsError) {
    const errorMessage = walletError?.message || apiKeysError?.message || transactionsError?.message
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Error loading dashboard data: {errorMessage}
        </AlertDescription>
      </Alert>
    )
  }

  // Safely calculate total pages
  const totalPages = transactionsData ? Math.ceil((transactionsData.totalCount || 0) / 10) : 0

  return (
    <div className="space-y-8">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Wallet Section */}
      {wallet ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl text-indigo-600">Wallet Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">${wallet.balance.toFixed(3)}</p>
          </CardContent>
        </Card>
      ) : (
        <Skeleton className="w-full h-32" />
      )}

      {/* API Key Management Section */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-center text-gray-900">API Key Management</h2>
        <div className="flex justify-center gap-4">
          <Button
            onClick={generateApiKey}
            disabled={isLoading || (Array.isArray(apiKeysData) && apiKeysData.length >= 2)} // Add Array.isArray check
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            <Key className="mr-2 h-4 w-4" />
            {isLoading ? "Generating..." : "Generate New API Key"}
          </Button>
          <Dialog>
  <DialogTrigger asChild>
    <Button className="bg-indigo-600 text-white hover:bg-indigo-700">
      <HelpCircle className="mr-2 h-4 w-4" />
      How to Use
    </Button>
  </DialogTrigger>
  <DialogContent className="max-w-full sm:max-w-3xl mx-auto max-h-[80vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle className="text-white">How to Use Your API Key</DialogTitle>
    </DialogHeader>
    <div className="mt-4 relative">
      <pre className="bg-gray-100 rounded-lg overflow-x-auto text-sm break-words">
        <code>
          {`
            require("dotenv").config();
            const express = require("express");
            const axios = require("axios");
            const cors = require("cors");

            const app = express();
            const PORT = process.env.PORT || 5000;

            app.use(express.json());
            app.use(cors());

            const OPENAI_API_URL = "<This Website's URL>/api/chat";
            const API_KEY = process.env.API_KEY;

            if (!OPENAI_API_KEY) {
              console.error("⚠️ Missing API Key. Set API_KEY in .env");
              process.exit(1);
            }

            app.post("/chat", async (req, res) => {
              try {
                const { messages, model = "gpt-4o", temperature = 0.7 } = req.body;

                if (!messages || !Array.isArray(messages)) {
                  return res.status(400).json({ error: "Invalid request format" });
                }

                const response = await axios.post(
                  OPENAI_API_URL,
                  { model, messages, temperature },
                  { headers: { Authorization: \`Bearer \${API_KEY}\` } }
                );

                res.json(response.data);
              } catch (error) {
                console.error("OpenAI API Error:", error?.response?.data || error.message);
                res.status(500).json({ error: "Failed to connect to OpenAI API" });
              }
            });

            app.listen(PORT, () => console.log(\`🚀 Server running on port \${PORT}\`));
          `}
        </code>
      </pre>
      <Button
        variant="outline"
        size="sm"
        className="absolute top-2 right-2 h-8 w-8 p-0"
        onClick={handleCopyClick}
      >
        {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
      </Button>
    </div>
  </DialogContent>
</Dialog>

        </div>

        {Array.isArray(apiKeysData) ? ( // Add Array.isArray check
          <div className="grid gap-6">
            {apiKeysData.map((key) => (
              <Card key={key._id}>
                <CardHeader>
                  <CardTitle className="text-xl text-indigo-600">API Key</CardTitle>
                  <CardDescription>Created on: {new Date(key.createdAt).toLocaleString()}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="font-mono bg-gray-100 p-3 rounded text-sm break-all">{key.key}</p>
                </CardContent>
                <CardFooter>
                  <Button 
                    variant="destructive" 
                    onClick={() => deleteApiKey(key.key)}
                    disabled={isLoading}
                    className="w-full"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {isLoading ? "Deleting..." : "Delete"}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid gap-6">
            {[...Array(2)].map((_, index) => (
              <Skeleton key={index} className="w-full h-40" />
            ))}
          </div>
        )}

        {Array.isArray(apiKeysData) && apiKeysData.length === 0 && (
          <p className="text-center text-gray-600">
            You haven't generated any API keys yet. Generate one to get started!
          </p>
        )}
      </div>

      {/* Transactions Section */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-center text-gray-900">Credit Transaction History</h2>
        
        {transactionsData && Array.isArray(transactionsData.transactions) ? (
          <>
            {transactionsData.transactions.length > 0 ? (
              <div className="grid gap-4">
                {transactionsData.transactions.map((transaction) => (
                  <Card key={transaction._id}>
                    <CardHeader>
                      <CardTitle className="text-lg text-indigo-600">
                        {transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
                      </CardTitle>
                      <CardDescription>{new Date(transaction.timestamp).toLocaleString()}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="font-bold">${transaction.amount.toFixed(2)}</p>
                      <p className="text-gray-600">{transaction.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-600">
                No transactions found. Transactions will appear here when you make your first API call.
              </p>
            )}

            {transactionsData.transactions.length > 0 && (
              <div className="flex items-center justify-between">
                <Button 
                  onClick={() => setPage(page > 1 ? page - 1 : 1)} 
                  disabled={page === 1}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  Previous
                </Button>
                <span className="text-sm text-gray-600">
                  Page {page} of {totalPages}
                </span>
                <Button 
                  onClick={() => setPage(page + 1)} 
                  disabled={page >= totalPages}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  Next
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="grid gap-4">
            {[...Array(3)].map((_, index) => (
              <Skeleton key={index} className="w-full h-32" />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}