# Bump Gen AI

A Next.js application that generates witty, suggestive, and humorous captions for images using Google's Vertex AI. The app includes features like image uploading, caption generation, and Google Sheets integration.

## Features

- 🖼️ Image upload and preview
- 🤖 AI-powered caption generation using Vertex AI
- 📋 Copy-to-clipboard functionality for captions
- 📊 Google Sheets integration for tracking
- 🌓 Dark mode support
- 📱 Responsive design

## Prerequisites

Before you begin, ensure you have the following:

- Node.js 18.x or later
- A Google Cloud Platform account with Vertex AI enabled
- A service account with access to Vertex AI
- A Google Sheets API setup (optional, for sheets integration)

## Setup

1. Clone the repository:

```bash
git clone <repository-url>
cd nextjs-boilerplate
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env.local` file in the root directory with the following variables:

```env
# Google Cloud & Vertex AI
GOOGLE_APPLICATION_CREDENTIALS_BASE64="your-base64-encoded-credentials"
ENDPOINT_NAME="projects/<project-id>/locations/<location>/endpoints/<endpoint-id>"

# Google Sheets (Optional)
GOOGLE_SHEETS_ID="your-google-sheets-id"
SHEET_API_URL="your-google-sheets-api-url"
```

To encode your Google Cloud credentials:

```bash
base64 -i path-to-your-service-account.json
```

4. Set up Google Cloud:
   - Create a project in Google Cloud Console
   - Enable Vertex AI API
   - Create a service account with Vertex AI access
   - Download the service account key JSON file
   - Create a Vertex AI endpoint for image caption generation

## Running Locally

1. Start the development server:

```bash
npm run dev
```

2. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
├── app/
│   ├── api/
│   │   ├── generate-captions/
│   │   └── search-sheet/
│   ├── components/
│   │   ├── CaptionCard.tsx
│   │   └── ImageUploader.tsx
│   └── page.tsx
├── public/
└── package.json
```

## API Endpoints

### `/api/generate-captions`

Generates captions for a given image URL using Vertex AI.

**Request:**

```json
{
  "imageUrl": "string",
  "prompt": "string (optional)"
}
```

**Response:**

```json
{
  "captions": ["string"]
}
```

### `/api/search-sheet`

Searches for an image URL in the connected Google Sheet.

**Request:**

```json
{
  "imageUrl": "string"
}
```

**Response:**

```json
{
  "sheetUrl": "string"
}
```

## Environment Variables

| Variable                              | Description                                     | Required |
| ------------------------------------- | ----------------------------------------------- | -------- |
| GOOGLE_APPLICATION_CREDENTIALS_BASE64 | Base64 encoded Google Cloud service account key | Yes      |
| ENDPOINT_NAME                         | Vertex AI endpoint name                         | Yes      |
| GOOGLE_SHEETS_ID                      | Google Sheets ID for integration                | No       |
| SHEET_API_URL                         | Google Sheets API endpoint                      | No       |
