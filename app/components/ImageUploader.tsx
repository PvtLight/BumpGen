"use client";

import { useState } from "react";
import Image from "next/image";

interface ImageUploaderProps {
  onImagesChange: (urls: string[]) => void;
}

export default function ImageUploader({ onImagesChange }: ImageUploaderProps) {
  const [urls, setUrls] = useState<string>("");
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [error, setError] = useState<string>("");
  const [loadingStates, setLoadingStates] = useState<{
    [key: string]: boolean;
  }>({});

  const validateImageUrl = async (url: string): Promise<boolean> => {
    try {
      const response = await fetch(url, {
        method: "HEAD",
        headers: {
          Accept: "image/*",
        },
      });

      const contentType = response.headers.get("content-type");
      const contentDisposition = response.headers.get("content-disposition");

      // Check if it's an image or has an attachment disposition with image filename
      const isImage = contentType?.startsWith("image/") ?? false;
      const hasImageAttachment =
        contentDisposition?.toLowerCase().includes("attachment") &&
        (contentDisposition?.toLowerCase().includes(".jpg") ||
          contentDisposition?.toLowerCase().includes(".jpeg") ||
          contentDisposition?.toLowerCase().includes(".png"));

      return isImage || hasImageAttachment || false;
    } catch (error) {
      console.error("Error validating image URL:", error);
      return true; // Allow the URL if validation fails, let the Image component handle errors
    }
  };

  const handleUrlChange = async (
    event: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    const value = event.target.value;
    setUrls(value);
    setError("");

    // Split URLs by newline or comma
    const urlList = value
      .split(/[\n,]/)
      .map((url) => url.trim())
      .filter((url) => url);

    if (urlList.length > 8) {
      setError("Maximum 8 images allowed");
      return;
    }

    // Reset loading states
    const newLoadingStates: { [key: string]: boolean } = {};
    urlList.forEach((url) => {
      newLoadingStates[url] = true;
    });
    setLoadingStates(newLoadingStates);

    // Add URLs immediately to show loading state
    setPreviewUrls(urlList);
    onImagesChange(urlList);

    // Validate URLs in background
    for (const url of urlList) {
      try {
        const isValid = await validateImageUrl(url);
        if (!isValid) {
          const newUrls = previewUrls.filter((u) => u !== url);
          setPreviewUrls(newUrls);
          onImagesChange(newUrls);
          setError(`Invalid image URL: ${url}`);
        }
      } catch (error) {
        console.error("Error validating URL:", error);
      }
      newLoadingStates[url] = false;
      setLoadingStates({ ...newLoadingStates });
    }
  };

  return (
    <div className='w-full space-y-4'>
      <div className='relative'>
        <textarea
          className='w-full h-24 p-3 border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent'
          placeholder='Enter image URLs (one per line or separated by commas)'
          value={urls}
          onChange={handleUrlChange}
        />
        {error && <p className='text-red-500 text-sm mt-1'>{error}</p>}
      </div>

      {previewUrls.length > 0 && (
        <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4'>
          {previewUrls.map((url, index) => (
            <div
              key={url}
              className='relative aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800'
            >
              {loadingStates[url] ? (
                <div className='absolute inset-0 flex items-center justify-center'>
                  <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500'></div>
                </div>
              ) : (
                <Image
                  src={url}
                  alt={`Preview ${index + 1}`}
                  fill
                  className='object-cover'
                  onError={() => {
                    const newUrls = previewUrls.filter((u) => u !== url);
                    setPreviewUrls(newUrls);
                    onImagesChange(newUrls);
                    setError(`Failed to load image ${index + 1}`);
                  }}
                  unoptimized
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
