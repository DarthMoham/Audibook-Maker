
# Audiobook Alchemist - Developer Documentation

## 1. Project Overview

Audiobook Alchemist is a web application designed to convert a series of audio files into a single, chapterized M4B audiobook file. Users can upload individual audio chapters, provide metadata such as book title and author, optionally include cover art, and then generate an M4B file ready for use in audiobook players.

## 2. Tech Stack

*   **Frontend:**
    *   **Next.js (App Router):** React framework for server-side rendering and static site generation.
    *   **React:** JavaScript library for building user interfaces.
    *   **TypeScript:** Superset of JavaScript adding static typing.
    *   **ShadCN/UI:** Re-usable UI components built with Radix UI and Tailwind CSS.
    *   **Tailwind CSS:** Utility-first CSS framework for styling.
    *   **React Hook Form:** For managing form state and validation.
    *   **Zod:** TypeScript-first schema declaration and validation library.
*   **Backend (API Route):**
    *   **Next.js API Routes:** Serverless functions for backend logic.
    *   **Formidable:** Node.js module for parsing form data, especially file uploads.
    *   **fluent-ffmpeg:** A fluent API for using FFmpeg (must be installed on the server/dev environment).
    *   **fs-extra:** Node.js module for file system operations (enhanced `fs` module).
    *   **tmp:** Node.js module for creating temporary files and directories.
*   **Development Tools:**
    *   **npm/yarn:** Package management.

## 3. Project Structure

```
.
├── src/
│   ├── app/                         # Next.js App Router
│   │   ├── api/convert/route.ts     # API route for M4B conversion
│   │   ├── globals.css              # Global styles and Tailwind CSS theme
│   │   ├── layout.tsx               # Root layout component
│   │   └── page.tsx                 # Main page component (hosts AudiobookForm)
│   ├── components/
│   │   ├── ui/                      # ShadCN UI components (Button, Card, Input, etc.)
│   │   ├── icons/                   # Custom SVG icons
│   │   └── AudiobookForm.tsx        # Core form component for audiobook creation
│   ├── hooks/
│   │   ├── use-toast.ts             # Custom hook for toast notifications
│   │   └── use-mobile.tsx           # Custom hook to detect mobile view
│   ├── lib/
│   │   ├── types.ts                 # TypeScript type definitions
│   │   ├── utils.ts                 # Utility functions (e.g., `cn` for Tailwind)
│   │   └── validation.ts            # Zod schemas for form validation
│   └── services/
│       └── audio-processor.ts       # Backend service for FFmpeg M4B conversion
├── public/                          # Static assets (e.g., images, fonts)
├── components.json                  # ShadCN UI configuration
├── next.config.ts                   # Next.js configuration
├── package.json                     # Project dependencies and scripts
├── tailwind.config.ts               # Tailwind CSS configuration
├── tsconfig.json                    # TypeScript configuration
└── DOCUMENTATION.md                 # This file
```

## 4. Core Functionality: M4B Conversion Workflow

The M4B conversion process involves the frontend form, an API route, and a backend audio processing service.

### 4.1. Frontend (`src/components/AudiobookForm.tsx`)

*   **Responsibilities:**
    *   Renders the user interface for inputting book title, author, cover art (optional), and audio chapter files.
    *   Allows users to edit chapter titles (prefilled from filenames).
    *   Uses `react-hook-form` for form state management.
    *   Uses Zod schemas (from `src/lib/validation.ts`) for client-side validation.
    *   On submit, constructs a `FormData` object containing all metadata and files.
    *   Sends the `FormData` to the `/api/convert` API route via a POST request.
    *   Displays conversion progress (simulated on client-side, with stage messages).
    *   Handles the response from the API:
        *   If successful, receives the M4B file as a blob and initiates a download.
        *   If an error occurs, displays an error toast.
*   **Key Components Used:** ShadCN UI components (`Card`, `Input`, `Button`, `Progress`, `Label`), `useToast` hook.

### 4.2. API Route (`src/app/api/convert/route.ts`)

*   **Responsibilities:**
    *   Handles POST requests to `/api/convert`.
    *   **File Uploads:** Uses `formidable` to parse the `multipart/form-data` request, extracting text fields and saving uploaded files (chapters, cover art) to a temporary directory.
    *   **Data Preparation:** Gathers all necessary metadata (`bookTitle`, `author`, chapter titles, paths to temporary audio/cover files).
    *   **Invokes Audio Processor:** Calls the `convertToM4B` function from `src/services/audio-processor.ts` with the prepared metadata.
    *   **Response Streaming:**
        *   If `convertToM4B` is successful, it streams the generated M4B file back to the client.
        *   Sets appropriate HTTP headers (`Content-Type: audio/mp4a-latm`, `Content-Disposition`, `Content-Length`).
    *   **Error Handling:** Catches errors from `formidable` or the `audio-processor` and returns appropriate JSON error responses.
    *   **Cleanup:** Ensures temporary directories used for uploads and FFmpeg processing are deleted after the operation (success or failure).
*   **Key Dependencies:** `formidable`, `fs-extra`, `tmp`, `next/server`.

### 4.3. Backend Audio Processing (`src/services/audio-processor.ts`)

*   **Responsibilities:**
    *   Contains the core logic for interacting with `ffmpeg` to create the M4B file.
    *   The main function is `convertToM4B(metadata: AudiobookMetadata)`.
    *   **Temporary Directory:** Creates a temporary directory for `ffmpeg` processing.
    *   **FFmpeg Metadata File:** Generates an `ffmpeg` compatible metadata text file (`ffmpeg_metadata.txt`) that defines global metadata (title, author) and chapter markers (start time, end time, title for each chapter). This requires probing each audio file for its duration using `ffprobe`.
    *   **FFmpeg Command Execution:**
        *   Uses `fluent-ffmpeg` to construct and run the `ffmpeg` command.
        *   Inputs: all chapter audio files, cover art image (if provided), and the generated `ffmpeg_metadata.txt`.
        *   Concatenates audio streams using a complex filter.
        *   Encodes audio to AAC.
        *   Embeds the cover art as an attached picture.
        *   Maps the chapter metadata from the `ffmpeg_metadata.txt` file.
        *   Outputs a single M4B file to the temporary processing directory.
    *   **Error Handling:** Captures `ffmpeg` errors and rejects the promise.
    *   **Return Value:** Resolves with the path to the generated M4B file.
*   **Key Dependencies:** `fluent-ffmpeg`, `fs-extra`, `tmp`, `path`.

## 5. UI Components

*   **ShadCN/UI (`src/components/ui/`):** The project heavily relies on pre-built components from ShadCN/UI. These components are styled with Tailwind CSS and are highly customizable. Refer to the individual files in this directory or the ShadCN/UI documentation for specifics.
*   **Custom Icons (`src/components/icons/`):** Contains custom SVG icons used in the application (e.g., `AudiobookIcon.tsx`).
*   **`AudiobookForm.tsx` (`src/components/`):** As detailed above, this is the central component orchestrating the user interaction for creating audiobooks.

## 6. Styling

*   **Tailwind CSS:** Used for all styling. Configuration is in `tailwind.config.ts`.
*   **Global Styles & Theme (`src/app/globals.css`):** Defines base Tailwind layers, global styles, and CSS variables for the ShadCN/UI theme (colors, radius, etc.). The application uses a custom color palette defined here.
*   **`cn` utility (`src/lib/utils.ts`):** A helper function to conditionally merge Tailwind CSS classes.

## 7. Validation (`src/lib/validation.ts`)

*   **Zod:** Used to define schemas for form data validation.
*   `audiobookFormSchema`: Defines the validation rules for the entire audiobook form, including book title, author, cover art (file type, size), and an array of chapters.
*   `chapterSchema`: Defines validation rules for individual chapter objects (file presence, title).
*   These schemas are used by `react-hook-form` (via `@hookform/resolvers/zod`) in `AudiobookForm.tsx` for client-side validation.

## 8. Key Dependencies (Summary)

*   **`formidable`**: For parsing multipart/form-data, especially file uploads in the API route.
*   **`fluent-ffmpeg`**: Node.js wrapper for the `ffmpeg` command-line tool, used for all audio processing tasks.
*   **`fs-extra`**: Provides more convenient file system methods than the built-in `fs` module.
*   **`tmp`**: For creating temporary files and directories, crucial for handling uploaded files and `ffmpeg` outputs before they are streamed or cleaned up.

## 9. Local Development Setup

1.  **Node.js and npm/yarn:** Ensure you have a recent version of Node.js and your preferred package manager installed.
2.  **Install FFmpeg:** `ffmpeg` (which includes `ffprobe`) **must be installed** on your system and accessible in your system's PATH. This is a critical dependency for the audio processing to work.
3.  **Install Project Dependencies:** Navigate to the project root and run `npm install` or `yarn install`.
4.  **Run Development Server:** `npm run dev` or `yarn dev`.
5.  Access the application at `http://localhost:9002` (or the port specified in `package.json`).

## 10. Potential Future Enhancements

*   Real-time server-side progress updates for `ffmpeg` conversion (e.g., using WebSockets or Server-Sent Events).
*   Queue system for handling long-running conversions, especially in a multi-user environment.
*   More advanced error reporting and recovery.
*   User authentication and storage of generated audiobooks.
