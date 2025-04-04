"use client";

import { useState } from "react";
import ImageUploader from "./components/ImageUploader";
import CaptionCard from "./components/CaptionCard";

const GOOGLE_SHEETS_ID = "1sQxYZY4c-VhaQ9PtsQ7-xEEYb3oweaAaFbiYAeSLUA0";
const SHEET_API_URL =
  "https://script.google.com/macros/s/AKfycbzRm2IY4fBDPpjL0byutOm0T12TEUdVLvlzKr-81YI-92Vc0o1GB11bKXr8F5uGfgVE/exec";

export default function Home() {
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{ [key: string]: string[] }>({});
  const [sheetUrls, setSheetUrls] = useState<{ [key: string]: string }>({});

  const searchInGoogleSheet = async (value: string) => {
    try {
      console.log("Searching for URL:", value);
      const response = await fetch(
        `${SHEET_API_URL}?value=${encodeURIComponent(value)}`
      );

      if (!response.ok) {
        console.error(
          "API response not OK:",
          response.status,
          response.statusText
        );
        return null;
      }

      const data = await response.json();
      console.log("Search response:", data);

      if (data.error) {
        console.error("API returned error:", data.error);
        return null;
      }

      if (!data.results || !Array.isArray(data.results)) {
        console.error("Invalid results format:", data);
        return null;
      }

      return data.results;
    } catch (error) {
      console.error("Error searching in Google Sheet:", error);
      return null;
    }
  };

  const generateGoogleSheetsUrl = async (imageUrl: string) => {
    try {
      console.log("Starting URL generation for:", imageUrl);

      // Search for the URL in the Google Sheet
      const searchResults = await searchInGoogleSheet(imageUrl);
      console.log("Search results:", searchResults);

      if (!searchResults || searchResults.length === 0) {
        console.error("No results found for URL:", imageUrl);
        return null;
      }

      // Get the first result (assuming we want the first match)
      const result = searchResults[0];
      console.log("Using result:", result);

      if (!result.sheetName || !result.rowNumber) {
        console.error("Invalid result format:", result);
        return null;
      }

      // Construct the Google Sheets URL with the specific sheet and row
      const baseUrl = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEETS_ID}/edit`;
      const searchParams = new URLSearchParams({
        gid: "1237467666",
        sheet: result.sheetName,
        range: `${result.sheetName}!A${result.rowNumber}:E${result.rowNumber}`,
      });

      const finalUrl = `${baseUrl}?${searchParams.toString()}`;
      console.log("Generated URL:", finalUrl);
      return finalUrl;
    } catch (error) {
      console.error("Error generating Google Sheets URL:", error);
      return null;
    }
  };

  const handleGenerateCaptions = async () => {
    if (imageUrls.length === 0) return;

    setLoading(true);
    const newResults: { [key: string]: string[] } = {};
    const newSheetUrls: { [key: string]: string } = {};

    try {
      // Generate captions and search for sheet URLs in parallel
      await Promise.all(
        imageUrls.map(async (url) => {
          try {
            // Generate captions
            const captionsResponse = await fetch("/api/generate-captions", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ imageUrl: url, prompt }),
            });

            if (!captionsResponse.ok) {
              console.error(`Failed to generate captions for ${url}`);
              return;
            }
            const captionsData = await captionsResponse.json();
            newResults[url] = captionsData.captions;

            // Search for sheet URL
            const sheetResponse = await fetch("/api/search-sheet", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ imageUrl: url }),
            });

            if (!sheetResponse.ok) {
              console.error(`Failed to search sheet for ${url}`);
              return;
            }
            const sheetData = await sheetResponse.json();
            if (sheetData.sheetUrl) {
              newSheetUrls[url] = sheetData.sheetUrl;
            }
          } catch (error) {
            console.error(`Error processing ${url}:`, error);
          }
        })
      );

      setResults(newResults);
      setSheetUrls(newSheetUrls);
    } catch (error) {
      console.error("Error generating captions:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleImagesChange = async (urls: string[]) => {
    console.log("Handling image change with URLs:", urls);
    setImageUrls(urls);
    // Clear sheet URLs when new images are uploaded
    setSheetUrls({});
  };

  return (
    <div className='min-h-screen bg-gray-50 dark:bg-gray-900 py-8'>
      <div className='container mx-auto px-4'>
        <h1 className='text-4xl font-bold text-center text-gray-900 dark:text-white mb-8'>
          Bump Gen AI
        </h1>

        <div className='max-w-4xl mx-auto space-y-8'>
          <ImageUploader onImagesChange={handleImagesChange} />

          <div className='space-y-4'>
            <textarea
              className='w-full h-24 p-3 border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              placeholder='Enter your prompt here (optional)'
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />

            <button
              className='w-full py-3 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md disabled:opacity-50 disabled:cursor-not-allowed'
              onClick={handleGenerateCaptions}
              disabled={imageUrls.length === 0 || loading}
            >
              {loading ? "Generating..." : "Generate Captions"}
            </button>
          </div>

          {imageUrls.length > 0 && (
            <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
              {imageUrls.map((url) => (
                <CaptionCard
                  key={url}
                  imageUrl={url}
                  captions={results[url] || []}
                  isLoading={loading}
                  googleSheetsUrl={sheetUrls[url]}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
