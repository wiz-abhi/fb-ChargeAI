import Link from "next/link"
import { ArrowRight, Key, Lock, Zap } from "lucide-react"

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-indigo-100 to-white">
      <div className="text-center max-w-4xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-5xl font-extrabold text-gray-900 sm:text-6xl md:text-7xl">
          Unlock the Power of <span className="text-indigo-600">AI</span>
        </h1>
        <p className="mt-6 text-xl text-gray-600 max-w-3xl mx-auto">
          Access  OpenAI models securely through our proxy API. Generate unique API keys and start building
          intelligent applications today.
        </p>
        <div className="mt-10">
          <Link
            href="/dashboard"
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
          >
            Get Started
            <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
        </div>
      </div>

      <div className="mt-20 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <FeatureCard
          icon={<Key className="h-8 w-8 text-indigo-600" />}
          title="Secure API Keys"
          description="Generate and manage unique API keys for your applications."
        />
        <FeatureCard
          icon={<Lock className="h-8 w-8 text-indigo-600" />}
          title="Enhanced Security"
          description="Your OpenAI API key remains hidden and protected."
        />
        <FeatureCard
          icon={<Zap className="h-8 w-8 text-indigo-600" />}
          title="Powerful AI Models"
          description="Access state-of-the-art OpenAI models through our proxy."
        />
      </div>
    </main>
  )
}

function FeatureCard({ icon, title, description }) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 flex flex-col items-center text-center">
      <div className="bg-indigo-100 rounded-full p-3 mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  )
}

