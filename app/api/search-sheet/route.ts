import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

// Add environment variables type safety
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  throw new Error(
    "GOOGLE_APPLICATION_CREDENTIALS environment variable is required"
  );
}

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
  "https://docs.google.com/spreadsheets/d/1r5Dnxq4LDwGTOadCyVXqEr-e0OgGNXK96Z74872w7Mc/edit";
const SPREADSHEET_ID = "1r5Dnxq4LDwGTOadCyVXqEr-e0OgGNXK96Z74872w7Mc";

interface SheetResult {
  sheet: string;
  row: number;
}

async function searchInGoogleSheet(value: string, sheetId: string) {
  try {
    console.log("Searching for URL in sheet:", value);

    // Decode base64 credentials from env
    const credentialsJson = Buffer.from(
      process.env.GOOGLE_APPLICATION_CREDENTIALS || "",
      "base64"
    ).toString();
    const credentials = JSON.parse(credentialsJson);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    // Get the sheet name from the ID
    const sheetName = Object.keys(SHEET_NAMES_IDS).find(
      (key) => SHEET_NAMES_IDS[key] === sheetId
    );
    if (!sheetName) {
      console.error("Sheet name not found for ID:", sheetId);
      return null;
    }

    // Search in column B (index 4)
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!B:B`,
    });

    const values = response.data.values;
    if (!values) {
      console.log("No data found in sheet");
      return null;
    }

    // Log first few values for debugging
    console.log("First few values in sheet:", values.slice(0, 5));

    // Clean up the search value and values from sheet for comparison
    const cleanValue = value.trim().toLowerCase();

    // Find the row with matching URL (1-based index)
    const rowIndex = values.findIndex((row: string[]) => {
      if (!row[0]) return false;
      const sheetValue = row[0].trim().toLowerCase();
      const matches = sheetValue === cleanValue;
      if (matches) {
        console.log("Found matching value:", sheetValue);
      }
      return matches;
    });

    if (rowIndex === -1) {
      console.log("URL not found in sheet. Trying partial match...");

      // Try partial match if exact match fails
      const partialMatchIndex = values.findIndex((row: string[]) => {
        if (!row[0]) return false;
        const sheetValue = row[0].trim().toLowerCase();
        // Extract the numeric ID from both URLs for comparison
        const urlIdMatch = /\/(\d+)\?/.exec(cleanValue);
        const sheetIdMatch = /\/(\d+)\?/.exec(sheetValue);
        if (urlIdMatch && sheetIdMatch && urlIdMatch[1] === sheetIdMatch[1]) {
          console.log("Found partial match with ID:", urlIdMatch[1]);
          return true;
        }
        return false;
      });

      if (partialMatchIndex === -1) {
        console.log("No partial match found either");
        return null;
      }

      const rowNumber = partialMatchIndex + 1;
      console.log("Found row (partial match):", rowNumber);
      return rowNumber;
    }

    const rowNumber = rowIndex + 1; // Convert to 1-based index
    console.log("Found row (exact match):", rowNumber);
    return rowNumber;
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

function buildSheetUrl(sheetName: string, row: number | undefined): string {
  const sheetId = SHEET_NAMES_IDS[sheetName];
  let url = `${BASE_SHEET_URL}?gid=${sheetId}#gid=${sheetId}`;
  if (row) {
    url += `&range=F${row}`;
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

    if (row !== null) {
      console.log("Found row for URL:", row);
    } else {
      console.log("No row found for URL");
    }

    const sheetUrl = buildSheetUrl(sheetName, row || undefined);
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
