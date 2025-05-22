# Audibook Maker - Codebase Documentation

## 1. Overview

This project, "Audibook Maker," is a Next.js application designed to convert a series of audio files and associated metadata (like book title, author, cover art) into a single M4B audiobook file.

The current codebase focuses on the backend logic for this conversion process, specifically through a Next.js Server Action. It includes data validation, simulated processing, and response handling.

## 2. Core Technologies

*   **Next.js:** React framework for building the application (App Router likely used).
*   **TypeScript:** For static typing and improved code quality.
*   **Zod:** For data validation (schemas for form inputs and server-side validation).
*   **Tailwind CSS:** For utility-first CSS styling (configuration provided).

## 3. Project Structure and Key Files

The primary logic is organized within the `src` directory.

### 3.1. Server-Side Logic (Next.js Server Actions)

*   **File:** `/home/mo/Coding_Projects/Random-Stuff/Audibook-Maker/src/app/actions.ts`
    *   **Purpose:** Contains Next.js Server Actions, which are functions that run on the server and can be called directly from client components. This is the heart of the backend processing.
    *   **Key Contents:**
        *   `convertToM4BAction`: The main server action responsible for:
            *   Receiving `FormData` (likely from a client-side form).
            *   Extracting and parsing data like book title, author, cover art file, and chapter information (which is expected as a JSON string).
            *   Validating the input data using a Zod schema (`m4bConversionInputSchema`).
            *   Currently, it *simulates* the M4B conversion process (e.g., using `setTimeout`).
            *   Returns a `ServerActionResponse` object indicating success or failure, along with data (like a download URL) or an error message.
        *   `m4bConversionInputSchema`: A Zod schema defined locally in this file to validate the inputs for the M4B conversion. It checks for `bookTitle`, `author`, `coverArtFileName` (optional), and an array of `chapters` (each with `name` and `title`).

### 3.2. Shared Libraries & Utilities (`src/lib/`)

This directory houses reusable code, types, and validation schemas.

*   **File:** `/home/mo/Coding_Projects/Random-Stuff/Audibook-Maker/src/lib/types.ts`
    *   **Purpose:** Defines shared TypeScript types used across the application.
    *   **Key Contents:**
        *   `ChapterClient`: Type definition for chapter data as it might be handled on the client-side (includes `id`, `file`, `name`, `title`).
        *   `AudiobookFormData`, `ChapterFormData`: Types inferred from Zod schemas defined in `validation.ts`. These are likely used for client-side form handling and validation.
        *   `ServerActionResponse<T>`: A crucial generic interface for standardizing the response structure from server actions. It includes `success` (boolean), optional `data` (of type `T`), and optional `error` (string or structured error object).

*   **File:** `/home/mo/Coding_Projects/Random-Stuff/Audibook-Maker/src/lib/validation.ts`
    *   **Purpose:** Contains Zod schemas for robust data validation, likely used both on the client-side (e.g., with React Hook Form) and server-side.
    *   **Key Contents:**
        *   `MAX_COVER_ART_SIZE`, `ACCEPTED_IMAGE_TYPES`, `ACCEPTED_AUDIO_TYPES`: Constants for validation rules.
        *   `chapterSchema`: Zod schema for validating individual chapter objects. It expects `id`, `file` (custom validation for `File` instance), `name`, and `title`.
        *   `audiobookFormSchema`: Zod schema for validating the main audiobook form. It includes:
            *   `bookTitle` (string, required).
            *   `author` (string, required).
            *   `coverArt` (optional `FileList`, transformed to a single `File` or `null`, with checks for file count, size, and image type).
            *   `chapters` (array of `chapterSchema`, requiring at least one chapter).
        *   `AudiobookFormValues`: TypeScript type inferred from `audiobookFormSchema`.

*   **File:** `/home/mo/Coding_Projects/Random-Stuff/Audibook-Maker/src/lib/utils.ts`
    *   **Purpose:** General utility functions.
    *   **Key Contents:**
        *   `cn`: A common utility function in Tailwind CSS projects that uses `clsx` and `tailwind-merge` to conditionally combine CSS class names.

### 3.3. Configuration Files (Root Directory)

*   **File:** `/home/mo/Coding_Projects/Random-Stuff/Audibook-Maker/next.config.ts`
    *   **Purpose:** Configuration for the Next.js framework.
    *   **Key Settings:**
        *   `typescript.ignoreBuildErrors: true`: Instructs Next.js to proceed with builds even if TypeScript errors are present.
        *   `eslint.ignoreDuringBuilds: true`: Instructs Next.js to skip ESLint checks during the build process.
        *   `images.remotePatterns`: Configures allowed external sources for images optimized by `next/image`. Currently allows images from `placehold.co`.

*   **File:** `/home/mo/Coding_Projects/Random-Stuff/Audibook-Maker/tailwind.config.ts`
    *   **Purpose:** Configuration for Tailwind CSS.
    *   **Key Settings:**
        *   `darkMode`: Enabled using the `class` strategy.
        *   `content`: Specifies the files Tailwind CSS should scan for class names.
        *   `theme.extend`: Customizes the default Tailwind theme with specific colors, border radius, fonts, keyframes, and animations.
        *   `plugins`: Includes `tailwindcss-animate` for animation utilities.

### 3.4. TypeScript Declarations

*   **File:** `/home/mo/Coding_Projects/Random-Stuff/Audibook-Maker/next-env.d.ts`
    *   **Purpose:** Standard Next.js file for global TypeScript type declarations, ensuring Next.js specific types are available throughout the project.

## 4. Key Functionalities & Data Flow

### 4.1. M4B Conversion (Simulated)

1.  **Client-Side (Assumed):** A form likely exists where the user inputs book details, uploads a cover image, and adds audio files for chapters. This form data is packaged, potentially as `FormData`.
2.  **Server Action Invocation:** The client calls the `convertToM4BAction` server action (from `/home/mo/Coding_Projects/Random-Stuff/Audibook-Maker/src/app/actions.ts`), passing the `FormData`.
3.  **Data Extraction & Parsing (`actions.ts`):**
    *   Basic fields like `bookTitle` and `author` are retrieved directly from `FormData`.
    *   The `coverArt` is retrieved as a `File` object.
    *   `chapters` data is expected as a JSON string within `FormData` and is parsed using `JSON.parse()`.
4.  **Server-Side Validation (`actions.ts`):**
    *   The extracted data (including the `coverArtFile?.name` and parsed `chapters`) is validated against `m4bConversionInputSchema`.
    *   If validation fails, a `ServerActionResponse` with `success: false` and an error message is returned.
5.  **Processing (Simulated) (`actions.ts`):**
    *   If validation passes, the action currently simulates a time-consuming M4B conversion process using `await new Promise(resolve => setTimeout(resolve, ...))`.
    *   A simulated filename and download URL are generated.
6.  **Response (`actions.ts`):**
    *   A `ServerActionResponse` is returned:
        *   On success: `success: true` and `data` containing `downloadUrl` and `fileName`.
        *   On error (either validation or during simulation): `success: false` and an `error` message.

## 5. Where to Look for Specific Code

*   **Core business logic for M4B conversion:**
    *   Primarily in `/home/mo/Coding_Projects/Random-Stuff/Audibook-Maker/src/app/actions.ts` (specifically `convertToM4BAction`).
*   **Data validation rules for audiobook/chapter inputs:**
    *   Server-side: `m4bConversionInputSchema` in `/home/mo/Coding_Projects/Random-Stuff/Audibook-Maker/src/app/actions.ts`.
    *   Client-side & potentially server-side (if reused): `audiobookFormSchema` and `chapterSchema` in `/home/mo/Coding_Projects/Random-Stuff/Audibook-Maker/src/lib/validation.ts`.
*   **Shared TypeScript type definitions:**
    *   `/home/mo/Coding_Projects/Random-Stuff/Audibook-Maker/src/lib/types.ts` (especially `ServerActionResponse`).
*   **Next.js specific configurations:**
    *   `/home/mo/Coding_Projects/Random-Stuff/Audibook-Maker/next.config.ts`.
*   **Styling and UI theme:**
    *   `/home/mo/Coding_Projects/Random-Stuff/Audibook-Maker/tailwind.config.ts`.
*   **Utility functions (e.g., classname merging):**
    *   `/home/mo/Coding_Projects/Random-Stuff/Audibook-Maker/src/lib/utils.ts`.

This documentation should provide a solid foundation for an LLM (or a human developer) to understand the structure and flow of your Audibook Maker application.
