import { NextRequest, NextResponse } from "next/server";
import * as aiplatform from "@google-cloud/aiplatform";

const MAX_TOKENS = 250;
const TEMPERATURE = 1;
const TOP_P = 0.95;
const MAX_RETRIES = 3;

export async function POST(req: NextRequest) {
  try {
    const { imageUrl, prompt } = await req.json();

    if (!imageUrl) {
      return NextResponse.json(
        { error: "Image URL is required" },
        { status: 400 }
      );
    }

    // Initialize Vertex AI client
    const endpoint = new aiplatform.v1.EndpointServiceClient({
      credentials: JSON.parse(
        process.env.GOOGLE_APPLICATION_CREDENTIALS || "{}"
      ),
    });

    const basePrompt = `
      Generate exactly **10** witty, suggestive, and humorous captions based on the given image.  
      Each caption must be a **short, clever one-liner** with a **playful** and **humorous** tone.  

      ⚠️ **Only 10 captions. Do NOT exceed this limit.**  

      Format the response as follows, including emojis:  
      1️⃣ [first caption]
      2️⃣ [second caption]
      3️⃣ [third caption]
      4️⃣ [fourth caption]
      5️⃣ [fifth caption]
      6️⃣ [sixth caption]
      7️⃣ [seventh caption]
      8️⃣ [eighth caption]
      9️⃣ [ninth caption]
      🔟 [tenth caption]
    `;

    const userPrompt = prompt ? `\n${prompt}` : "";

    const instances = [
      {
        prompt: basePrompt + userPrompt,
        multi_modal_data: { image: imageUrl },
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE,
        top_p: TOP_P,
      },
    ];

    let retryCount = 0;
    let captions: string[] = [];

    while (retryCount < MAX_RETRIES) {
      try {
        const [response] = await endpoint.predict({
          endpoint: process.env.ENDPOINT_NAME || "",
          instances: instances,
        });

        if (
          response &&
          response.predictions &&
          response.predictions.length > 0
        ) {
          const responseText = response.predictions[0] as string;
          captions = extractCaptions(responseText);

          if (captions.length >= 6) {
            break;
          }
        }
      } catch (error) {
        console.error("Prediction error:", error);
      }

      retryCount++;
    }

    // Ensure there are always 10 captions
    captions = [...captions, ...Array(10 - captions.length).fill("")];

    return NextResponse.json({ captions });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Failed to generate captions" },
      { status: 500 }
    );
  }
}

function extractCaptions(responseText: string): string[] {
  const lines = responseText.trim().split("\n");
  const captions: string[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Check for numbered or emoji-numbered lines
    if (/^(\d+[\.:]|\d️⃣|🔟)\s+/.test(trimmedLine)) {
      const parts = trimmedLine.split(/\s+/);
      if (parts.length > 1) {
        captions.push(parts.slice(1).join(" "));
      }
    } else if (trimmedLine.length > 0 && /\w+/.test(trimmedLine)) {
      captions.push(trimmedLine);
    }
  }

  return captions;
}
