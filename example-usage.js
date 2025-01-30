import axios from "axios"

const API_KEY = "your-generated-api-key"
const API_URL = "http://localhost:3000"

async function generateText(prompt, model = "gpt-3.5-turbo") {
  try {
    const response = await axios.post(
      `${API_URL}/api/chat`,
      {
        messages: [{ role: "user", content: prompt }],
        model: model,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY,
        },
      },
    )
    console.log("Response:", response.data.choices[0].message.content)
    console.log("Tokens used:", response.data.usage.total_tokens)
    console.log("Cost:", response.data.cost)
    console.log("Remaining balance:", response.data.remainingBalance)
  } catch (error) {
    console.error("Error:", error.response ? error.response.data : error.message)
  }
}

// Example usage
generateText("Hello, how are you?", "gpt-3.5-turbo")
generateText("Explain quantum computing", "gpt-4")

console.log(
  "Example usage code loaded successfully. Replace 'your-generated-api-key' with an actual key before running.",
)

