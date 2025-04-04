import { NextRequest, NextResponse } from "next/server";

const SHEET_NAMES_IDS: { [key: string]: string } = {
  "Alaya Paid": "2096299055",
  "Alix Free": "1109464436",
  "Amber Paid": "68202088",
  "Angela Paid": "661502868",
  "Autumn Free": "475314965",
  "Autumn Paid": "642095320",
  "Bri Free": "1269410297",
  "Bri VIP": "1245086286",
  "Coco VIP": "1635596190",
  "Colby Free": "1632280389",
  "Dan Paid": "1694644436",
  "Emily Ray Free": "165366325",
  "Emmie Free": "1062337858",
  "Essie Paid": "1298371478",
  "Forrest Paid": "1237467666",
  "Jaileen Free": "1751209681",
  "Jaileen VIP": "658317867",
  "Kelly Paid": "1934645087",
  "Kenzie Free": "783014756",
  "Laila Paid": "1075461981",
  "Lala Free": "2140596445",
  "Lala VIP": "956812246",
  "McKinley Free": "1425642455",
  "Mel Free": "1162339048",
  "Michelle Free": "1234072977",
  "MJ Paid": "1210054249",
  "Nicole Free": "166958570",
  "Sage VIP": "1188324103",
  "Salah VIP": "111829368",
  "Sirena Paid": "623356977",
  "Sky Free": "2141458380",
  "Sophie Paid": "1926685400",
  "Tita VIP": "285787704",
  "V Free": "577942680",
};

const BASE_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1IBlBPFGDw19PhexlPowIbFw0xKleMDn8JCxrOM17ExA/edit";
const SHEET_API_URL =
  "https://script.google.com/macros/s/AKfycbzRm2IY4fBDPpjL0byutOm0T12TEUdVLvlzKr-81YI-92Vc0o1GB11bKXr8F5uGfgVE/exec";

interface SheetResult {
  sheet: string;
  row: number;
}

async function searchInGoogleSheet(value: string, sheetId: string) {
  try {
    console.log("Searching for URL in sheet:", value);
    const response = await fetch(
      `${SHEET_API_URL}?value=${encodeURIComponent(value)}&sheetId=${sheetId}`
    );
    const data = await response.json();

    if (data.error) {
      console.error("Error:", data.error);
      return null;
    }

    if (!data.results || !Array.isArray(data.results)) {
      console.error("Invalid results format:", data);
      return null;
    }

    // Log the full results for debugging
    console.log("Search results:", data.results);

    // Return the row number from the first result
    if (data.results.length > 0 && data.results[0].row) {
      console.log("Found row:", data.results[0].row);
      return data.results[0].row;
    }

    console.log("No row found in results");
    return null;
  } catch (error) {
    console.error("Error searching in Google Sheet:", error);
    return null;
  }
}

function extractNameFromUrl(url: string): string | null {
  console.log("Extracting name from URL:", url);

  // Try to extract name from different URL patterns
  const patterns = [
    /\/([^/]+)\.[^.]+$/, // Standard filename pattern
    /\/([^/]+)$/, // URL ending with name
    /([^/]+)\.[^.]+$/, // Just filename
    /([^/]+)$/, // Just name
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      const name = match[1];
      console.log("Extracted name:", name);

      // Find the matching sheet name (case-insensitive)
      const sheetName = Object.keys(SHEET_NAMES_IDS).find((key) => {
        const keyLower = key.toLowerCase();
        const nameLower = name.toLowerCase();
        return (
          keyLower.includes(nameLower) ||
          nameLower.includes(keyLower.split(" ")[0])
        );
      });

      if (sheetName) {
        console.log("Found matching sheet name:", sheetName);
        return sheetName;
      }
    }
  }

  console.log("No matching sheet name found for URL:", url);
  return null;
}

function buildSheetUrl(sheetName: string, row?: number): string {
  const sheetId = SHEET_NAMES_IDS[sheetName];
  let url = `${BASE_SHEET_URL}?gid=${sheetId}#gid=${sheetId}`;
  if (row) {
    url += `&range=E${row}`;
  }
  console.log("Built sheet URL with range:", url);
  return url;
}

export async function POST(req: NextRequest) {
  try {
    const { imageUrl } = await req.json();
    console.log("Received image URL:", imageUrl);

    if (!imageUrl) {
      console.log("No image URL provided");
      return NextResponse.json(
        { error: "Image URL is required" },
        { status: 400 }
      );
    }

    const sheetName = extractNameFromUrl(imageUrl);

    if (!sheetName) {
      console.log("Could not determine sheet name from URL");
      return NextResponse.json(
        { error: "Could not determine sheet name from image URL" },
        { status: 400 }
      );
    }

    const sheetId = SHEET_NAMES_IDS[sheetName];
    console.log("Searching in sheet:", sheetName, "with ID:", sheetId);
    const row = await searchInGoogleSheet(imageUrl, sheetId);

    if (row) {
      console.log("Found row for URL:", row);
    } else {
      console.log("No row found for URL");
    }

    const sheetUrl = buildSheetUrl(sheetName, row);
    console.log("Returning sheet URL:", sheetUrl);
    return NextResponse.json({ sheetUrl });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
