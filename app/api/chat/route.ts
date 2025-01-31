import { NextResponse } from "next/server"
import axios, { AxiosInstance } from "axios"
import { getWalletByApiKey, updateWalletBalance } from "@/lib/mongodb"
import { calculateCost } from "@/lib/pricing"
import { rateLimit } from "@/lib/rate-limit"
import { Redis } from "ioredis"
import crypto from "crypto"

// Constants
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, api-key',
  'Access-Control-Max-Age': '86400',
}

const AZURE_CONFIG = {
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  apiVersion: "2023-05-15",
}

const MODEL_DEPLOYMENTS = {
  'gpt-4': process.env.AZURE_GPT4_DEPLOYMENT_NAME,
  'gpt-4o': process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
  'gpt-3.5-turbo': process.env.AZURE_GPT35_DEPLOYMENT_NAME,
}

// Initialize Redis with keepAlive
const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  retryStrategy: (times) => Math.min(times * 50, 2000),
  keepAlive: 30000,
  maxRetriesPerRequest: 3
})

// Create axios instance with optimized settings
const axiosInstance: AxiosInstance = axios.create({
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
  keepAlive: true,
  maxRedirects: 5,
  maxContentLength: Infinity,
  maxBodyLength: Infinity,
})

// Cache configuration
const CACHE_TTL = 3600
const WALLET_CACHE_TTL = 300 // 5 minutes cache for wallet info

// Generate cache key from request parameters
const generateCacheKey = (messages: any[], model: string, temperature?: number, max_tokens?: number): string => {
  const data = JSON.stringify({ messages, model, temperature, max_tokens })
  return crypto.createHash('md5').update(data).digest('hex')
}

// Wallet cache implementation
const walletCache = new Map()

// Optimized wallet fetching with cache
async function getCachedWallet(apiKey: string) {
  const cachedWallet = walletCache.get(apiKey)
  if (cachedWallet && Date.now() - cachedWallet.timestamp < WALLET_CACHE_TTL * 1000) {
    return cachedWallet.data
  }
  
  const wallet = await getWalletByApiKey(apiKey)
  if (wallet) {
    walletCache.set(apiKey, {
      data: wallet,
      timestamp: Date.now()
    })
  }
  return wallet
}

// Parse SSE data
function parseSSEResponse(chunk: string) {
  const lines = chunk.split('\n')
  const parsedLines = []
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const jsonStr = line.slice(6) // Remove 'data: ' prefix
      if (jsonStr === '[DONE]') continue
      try {
        const parsed = JSON.parse(jsonStr)
        parsedLines.push(parsed)
      } catch (e) {
        console.error('Failed to parse SSE data:', e)
      }
    }
  }
  
  return parsedLines
}

// Parallel validation function
async function validateRequest(apiKey: string, model: string) {
  // First, get the wallet
  const wallet = await getCachedWallet(apiKey)
  if (!wallet) {
    throw new Error("Invalid API key")
  }

  // Then, run rate limit check and deployment name check in parallel
  const [rateLimitResult, deploymentName] = await Promise.all([
    wallet.userId ? rateLimit(wallet.userId) : { success: true },
    MODEL_DEPLOYMENTS[model]
  ])

  if (!rateLimitResult.success) {
    throw new Error("Rate limit exceeded")
  }

  if (!deploymentName) {
    throw new Error("Invalid model specified")
  }

  return { wallet, deploymentName }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS
  })
}

export async function POST(request: Request) {
  const controller = new AbortController()
  const signal = controller.signal

  try {
    const { messages, model = "gpt-4o", temperature, max_tokens, stream = false } = await request.json()
    const apiKey = request.headers.get("api-key")

    if (!apiKey) {
      return NextResponse.json(
        { error: "API key is required" },
        { status: 401, headers: CORS_HEADERS }
      )
    }

    // Check cache first (only for non-streaming requests)
    if (!stream) {
      const cacheKey = generateCacheKey(messages, model, temperature, max_tokens)
      const cachedResponse = await redis.get(cacheKey)
      
      if (cachedResponse) {
        const parsed = JSON.parse(cachedResponse)
        const { wallet } = await validateRequest(apiKey, model)
        const cost = calculateCost(model, parsed.usage.total_tokens)
        
        if (wallet.balance < cost) {
          return NextResponse.json(
            { error: "Insufficient funds" },
            { status: 402, headers: CORS_HEADERS }
          )
        }

        return NextResponse.json({
          ...parsed,
          cost,
          remainingBalance: wallet.balance - cost,
          cached: true
        }, { headers: CORS_HEADERS })
      }
    }

    // Validate request
    const { wallet, deploymentName } = await validateRequest(apiKey, model)

    if (stream) {
      // Streaming response handling
      const encoder = new TextEncoder()
      const streamResponse = new TransformStream()
      const writer = streamResponse.writable.getWriter()

      const response = await axiosInstance.post(
        `${AZURE_CONFIG.endpoint}/openai/deployments/${deploymentName}/chat/completions`,
        {
          messages,
          model,
          temperature,
          max_tokens,
          stream: true
        },
        {
          params: { 'api-version': AZURE_CONFIG.apiVersion },
          headers: { "api-key": AZURE_CONFIG.apiKey },
          responseType: 'stream',
          signal
        }
      )

      let lastChunk: any = null
      
      response.data.on('data', async (chunk: Buffer) => {
        const text = chunk.toString()
        const parsed = parseSSEResponse(text)
        
        for (const item of parsed) {
          lastChunk = item // Store the last chunk for usage calculation
          await writer.write(encoder.encode(`data: ${JSON.stringify(item)}\n\n`))
        }
      })

      response.data.on('end', async () => {
        if (lastChunk?.usage) {
          const cost = calculateCost(model, lastChunk.usage.total_tokens)
          await updateWalletBalance(wallet.userId, -cost, `Chat completion (${model})`)
        }
        await writer.write(encoder.encode('data: [DONE]\n\n'))
        await writer.close()
      })

      return new NextResponse(streamResponse.readable, {
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      })
    } else {
      // Non-streaming response handling
      const response = await axiosInstance.post(
        `${AZURE_CONFIG.endpoint}/openai/deployments/${deploymentName}/chat/completions`,
        {
          messages,
          model,
          temperature,
          max_tokens,
          stream: false
        },
        {
          params: { 'api-version': AZURE_CONFIG.apiVersion },
          headers: { "api-key": AZURE_CONFIG.apiKey },
          signal
        }
      )

      const completionResponse = response.data
      const cost = calculateCost(model, completionResponse.usage.total_tokens)
      
      // Update wallet balance
      await updateWalletBalance(wallet.userId, -cost, `Chat completion (${model})`);
await redis.setex(`wallet:${apiKey}`, WALLET_CACHE_TTL, JSON.stringify({ ...wallet, balance: wallet.balance - cost }));


      // Cache the response
      const cacheKey = generateCacheKey(messages, model, temperature, max_tokens)
      await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(completionResponse))

      return NextResponse.json({
        ...completionResponse,
        cost,
        remainingBalance: wallet.balance - cost
      }, { headers: CORS_HEADERS })
    }

  } catch (error) {
    controller.abort()
    console.error("Failed to process chat request:", error)
    
    return NextResponse.json(
      { error: error.message || "An internal error occurred" },
      { status: error.response?.status || 500, headers: CORS_HEADERS }
    )
  }
}