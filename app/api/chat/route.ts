import { NextResponse } from "next/server"
import axios from "axios"
import { getWalletByApiKey, updateWalletBalance } from "@/lib/mongodb"
import { calculateCost } from "@/lib/pricing"
import { rateLimit } from "@/lib/rate-limit"

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

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, api-key',
  'Access-Control-Max-Age': '86400',
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS
  })
}

const validateConfig = () => {
  if (!AZURE_CONFIG.endpoint || !AZURE_CONFIG.apiKey) {
    throw new Error("Missing required Azure configuration")
  }
}

const getDeploymentName = (model: string): string => {
  const deploymentName = MODEL_DEPLOYMENTS[model]
  if (!deploymentName) {
    throw new Error(`Unsupported model: ${model}`)
  }
  return deploymentName
}

export async function POST(request: Request) {
  try {
    validateConfig()

    const { messages, model = "gpt-4o", temperature, max_tokens } = await request.json()
    const apiKey = request.headers.get("api-key")

    if (!apiKey) {
      return NextResponse.json(
        { error: "API key is required" },
        { status: 401, headers: CORS_HEADERS }
      )
    }

    const wallet = await getWalletByApiKey(apiKey)
    if (!wallet) {
      return NextResponse.json(
        { error: "Invalid API key" },
        { status: 401, headers: CORS_HEADERS }
      )
    }

    // Rate limiting check
    if (wallet.userId) {
      const rateLimitResult = await rateLimit(wallet.userId)
      if (!rateLimitResult.success) {
        return NextResponse.json(
          { error: "Rate limit exceeded. Please try again later." },
          { status: 429, headers: CORS_HEADERS }
        )
      }
    }

    let deploymentName
    try {
      deploymentName = getDeploymentName(model)
    } catch (error) {
      return NextResponse.json(
        { error: "Invalid model specified" },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    const response = await axios.post(
      `${AZURE_CONFIG.endpoint}/openai/deployments/${deploymentName}/chat/completions`,
      {
        messages,
        model,
        temperature,
        max_tokens,
      },
      {
        params: {
          'api-version': AZURE_CONFIG.apiVersion
        },
        headers: {
          "Content-Type": "application/json",
          "api-key": AZURE_CONFIG.apiKey,
        },
      }
    )

    const tokensUsed = response.data.usage.total_tokens
    const cost = calculateCost(model, tokensUsed)

    if (wallet.balance < cost) {
      return NextResponse.json(
        { error: "Insufficient funds" },
        { status: 402, headers: CORS_HEADERS }
      )
    }

    // Keep the original wallet update logic
    await updateWalletBalance(wallet.userId, -cost, `Chat completion (${model})`)

    return NextResponse.json({
      ...response.data,
      cost,
      remainingBalance: wallet.balance - cost,
    }, { headers: CORS_HEADERS })

  } catch (error) {
    console.error("Failed to process chat request:", error)
    if (axios.isAxiosError(error)) {
      return NextResponse.json({
        error: error.response?.data?.error?.message || "Failed to process chat request"
      }, { status: error.response?.status || 500, headers: CORS_HEADERS })
    }

    return NextResponse.json(
      { error: "An internal error occurred" },
      { status: 500, headers: CORS_HEADERS }
    )
  }
}