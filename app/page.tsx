"use client";

import { useState } from "react";
import ImageUploader from "./components/ImageUploader";
import CaptionCard from "./components/CaptionCard";

export default function Home() {
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{ [key: string]: string[] }>({});

  const handleGenerateCaptions = async () => {
    if (imageUrls.length === 0) return;

    setLoading(true);
    const newResults: { [key: string]: string[] } = {};

    try {
      await Promise.all(
        imageUrls.map(async (url) => {
          const response = await fetch("/api/generate-captions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageUrl: url, prompt }),
          });

          if (!response.ok) throw new Error("Failed to generate captions");

          const data = await response.json();
          newResults[url] = data.captions;
        })
      );

      setResults(newResults);
    } catch (error) {
      console.error("Error generating captions:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='min-h-screen bg-gray-50 dark:bg-gray-900 py-8'>
      <div className='container mx-auto px-4'>
        <h1 className='text-4xl font-bold text-center text-gray-900 dark:text-white mb-8'>
          Bump Gen AI
        </h1>

        <div className='max-w-4xl mx-auto space-y-8'>
          <ImageUploader onImagesChange={setImageUrls} />

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
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
