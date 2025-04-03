import { NextRequest, NextResponse } from "next/server";
import { GoogleAuth } from "google-auth-library";
import { VertexAI } from "@google-cloud/vertexai";

const MAX_TOKENS = 250;
const TEMPERATURE = 1;
const TOP_P = 0.95;
const MAX_RETRIES = 3;

// Initialize Google Auth client
const initializeAuth = async () => {
  try {
    console.log("Initializing Google Auth client...");
    const credentialsBase64 = process.env.GOOGLE_APPLICATION_CREDENTIALS;

    if (!credentialsBase64) {
      throw new Error(
        "GOOGLE_APPLICATION_CREDENTIALS environment variable is not set"
      );
    }

    // Decode base64 credentials
    const credentials = JSON.parse(
      Buffer.from(credentialsBase64, "base64").toString()
    );

    console.log("Project ID:", credentials.project_id);

    const auth = new GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });

    console.log("Auth client initialized successfully");
    return auth;
  } catch (error) {
    console.error("Error initializing auth:", error);
    throw new Error("Failed to initialize authentication");
  }
};

const predict = async (instance: any) => {
  try {
    console.log("Starting prediction...");
    const auth = await initializeAuth();
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();

    if (!process.env.ENDPOINT_NAME) {
      throw new Error("ENDPOINT_NAME environment variable is not set");
    }
    console.log("Using endpoint:", process.env.ENDPOINT_NAME);

    // Create the request body
    const requestBody = {
      instances: [
        {
          prompt: instance.prompt,
          multi_modal_data: {
            image: instance.multi_modal_data.image,
          },
          max_tokens: instance.max_tokens,
          temperature: instance.temperature,
          top_p: instance.top_p,
        },
      ],
    };

    console.log("Request body:", JSON.stringify(requestBody, null, 2));

    const response = await fetch(
      `https://us-central1-aiplatform.googleapis.com/v1/${process.env.ENDPOINT_NAME}:predict`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Prediction API error:", errorText);
      throw new Error(`Prediction request failed: ${response.statusText}`);
    }

    console.log("Received prediction response");
    const result = await response.json();
    console.log("Raw prediction result:", JSON.stringify(result, null, 2));
    return result.predictions || [];
  } catch (error) {
    console.error("Prediction error:", error);
    throw error;
  }
};

function extractCaptions(responseText: string): string[] {
  console.log("Extracting captions from:", responseText);
  const response_lines = responseText.trim().split("\n");
  const captions: string[] = [];

  for (const line of response_lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    // Check if line starts with a numbered emoji or digit (caption format)
    if (
      trimmedLine.match(/^[1-9][\.:)]/) || // Matches 1. 1: 1) etc
      trimmedLine.match(/^10[\.:)]/) || // Matches 10. 10: 10)
      trimmedLine.startsWith("1️⃣") ||
      trimmedLine.startsWith("2️⃣") ||
      trimmedLine.startsWith("3️⃣") ||
      trimmedLine.startsWith("4️⃣") ||
      trimmedLine.startsWith("5️⃣") ||
      trimmedLine.startsWith("6️⃣") ||
      trimmedLine.startsWith("7️⃣") ||
      trimmedLine.startsWith("8️⃣") ||
      trimmedLine.startsWith("9️⃣") ||
      trimmedLine.startsWith("🔟")
    ) {
      // Split by first space after the number/emoji
      const parts = trimmedLine.split(/[\.:)\s]/).filter(Boolean);
      if (parts.length > 1) {
        // Join all parts except the first (number/emoji)
        captions.push(parts.slice(1).join(" "));
      }
    } else if (trimmedLine.length > 3) {
      // If it's a valid caption (more than 3 words)
      captions.push(trimmedLine);
    }
  }

  console.log("Extracted captions:", captions);
  return captions;
}

function parseLLMResponse(response: string): string {
  console.log("Parsing LLM response:", response);

  // If response contains "Output", take everything after it
  if (response.includes("Output")) {
    const parts = response.split("Output");
    return parts[parts.length - 1].trim();
  }

  return response.trim();
}

export async function POST(req: NextRequest) {
  try {
    console.log("Received POST request");
    const { imageUrl, prompt } = await req.json();
    console.log("Image URL:", imageUrl);
    console.log("User prompt:", prompt);

    if (!imageUrl) {
      return NextResponse.json(
        { error: "Image URL is required" },
        { status: 400 }
      );
    }

    const basePrompt = `
      Generate exactly 10 witty, suggestive, and humorous captions based on the given image.
      Each caption must be a short, clever one-liner with a playful and humorous tone.
      Keep each caption concise and engaging.
      Do not include any explanations or additional text.
      Just provide the 10 captions, one per line.
      Format each caption with a number (1-10) followed by a period and space.
      Example format:
      1. First caption
      2. Second caption
      etc.
    `;

    const userPrompt = prompt ? `\n${prompt}` : "";

    const instance = {
      prompt: basePrompt + userPrompt,
      multi_modal_data: { image: imageUrl },
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
      top_p: TOP_P,
    };

    console.log("Prepared instance:", instance);

    let retryCount = 0;
    let captions: string[] = [];

    while (retryCount < MAX_RETRIES) {
      try {
        console.log(`Attempt ${retryCount + 1} of ${MAX_RETRIES}`);
        const predictions = await predict(instance);
        console.log("Received predictions:", predictions);

        if (predictions && predictions.length > 0) {
          const responseText = parseLLMResponse(predictions[0].toString());
          if (responseText) {
            captions = extractCaptions(responseText);

            if (captions.length >= 6) {
              console.log("Got enough captions, breaking retry loop");
              break;
            }
          }
        }
      } catch (error) {
        console.error(`Error in attempt ${retryCount + 1}:`, error);
      }

      retryCount++;
    }

    // Ensure we have exactly 10 captions
    if (captions.length > 10) {
      captions = captions.slice(0, 10);
    } else if (captions.length < 10) {
      captions = [...captions, ...Array(10 - captions.length).fill("")];
    }

    console.log("Final captions:", captions);
    return NextResponse.json({ captions });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Failed to generate captions" },
      { status: 500 }
    );
  }
}
