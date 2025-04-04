"use client";

import { useState } from "react";
import Image from "next/image";
import { CheckIcon, ClipboardIcon } from "@heroicons/react/24/outline";

interface CaptionCardProps {
  imageUrl: string;
  captions: string[];
  isLoading?: boolean;
  googleSheetsUrl?: string;
}

export default function CaptionCard({
  imageUrl,
  captions,
  isLoading = false,
  googleSheetsUrl,
}: CaptionCardProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopy = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error("Failed to copy text:", err);
    }
  };

  return (
    <div className='bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-lg'>
      <div className='relative aspect-square'>
        <Image
          src={imageUrl}
          alt='Uploaded image'
          fill
          className='object-cover'
        />
        {googleSheetsUrl && (
          <a
            href={googleSheetsUrl}
            target='_blank'
            rel='noopener noreferrer'
            className='absolute top-2 right-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md text-sm font-medium shadow-md transition-colors'
          >
            View in Sheet
          </a>
        )}
      </div>

      <div className='p-4'>
        {isLoading ? (
          <div className='space-y-4'>
            {[...Array(3)].map((_, i) => (
              <div key={i} className='animate-pulse'>
                <div className='h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4'></div>
              </div>
            ))}
          </div>
        ) : (
          <div className='space-y-2'>
            {captions.map((caption, index) => (
              <div
                key={index}
                className='group flex items-center justify-between p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors'
              >
                <p className='text-sm text-gray-700 dark:text-gray-300 flex-1 mr-2'>
                  {caption}
                </p>
                <button
                  onClick={() => handleCopy(caption, index)}
                  className='text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors'
                >
                  {copiedIndex === index ? (
                    <CheckIcon className='w-5 h-5 text-green-500' />
                  ) : (
                    <ClipboardIcon className='w-5 h-5' />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
