
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { IncomingForm, type File as FormidableFile } from 'formidable';
import fs from 'fs-extra';
import path from 'path';
import tmp from 'tmp';
import { Readable } from 'stream'; // For Readable.fromWeb and Node.js stream operations
// import { ReadableStream as WebReadableStream } from 'stream/web'; // For type hint if needed, Readable.toWeb provides instance

import { convertToM4B, type ChapterInput, type AudiobookMetadata } from '@/services/audio-processor';

export const config = {
  api: {
    bodyParser: false, // Important: prevent Next.js from parsing the body
  },
};

// Helper to get the first field value if it's an array (Formidable can return arrays)
const getFirstField = (fieldValue: string | string[] | undefined): string | undefined => {
  if (Array.isArray(fieldValue)) {
    return fieldValue[0];
  }
  return fieldValue;
};

export async function POST(req: NextRequest) {
  let tempUploadDirPath: string | null = null; // For Formidable uploads
  let m4bOutputContainingDir: string | null = null; // For the directory holding the final M4B

  try {
    const tempDirObject = tmp.dirSync({ unsafeCleanup: true });
    tempUploadDirPath = tempDirObject.name;
    console.log('Created temp upload directory for Formidable:', tempUploadDirPath);

    const form = new IncomingForm({
      uploadDir: tempUploadDirPath,
      keepExtensions: true,
      multiples: true,
      maxFileSize: 2000 * 1024 * 1024,
      maxFieldsSize: 100 * 1024 * 1024,
    });

    const formidableHeaders: { [key: string]: string } = {};
    const contentType = req.headers.get('content-type');
    if (contentType) {
      formidableHeaders['content-type'] = contentType;
    } else {
      console.error("Missing 'content-type' header in request.");
      if (tempUploadDirPath) await fs.remove(tempUploadDirPath);
      return NextResponse.json({ error: "Missing 'content-type' header." }, { status: 400 });
    }
    const contentLength = req.headers.get('content-length');
    if (contentLength) {
      formidableHeaders['content-length'] = contentLength;
    }
    console.log("Prepared headers for Formidable:", JSON.stringify(formidableHeaders));

    if (!req.body) {
      console.error('No request body found');
      if (tempUploadDirPath) await fs.remove(tempUploadDirPath);
      return NextResponse.json({ error: 'No request body found' }, { status: 400 });
    }
    
    const nodeStreamForParser = Readable.fromWeb(req.body as any);
    const mockReq = nodeStreamForParser as any;
    mockReq.headers = formidableHeaders;

    return await new Promise<NextResponse>((resolveResponse, rejectResponseInternal) => {
      const cleanupAndReject = async (errorResponse: NextResponse) => {
        if (tempUploadDirPath) {
          try { await fs.remove(tempUploadDirPath); console.log('Cleaned up Formidable upload directory on error:', tempUploadDirPath); }
          catch (e) { console.error("Error cleaning up Formidable upload directory during rejection:", e); }
        }
        if (m4bOutputContainingDir) { // Changed from ffmpegProcessingDir
           try { await fs.remove(m4bOutputContainingDir); console.log('Cleaned up M4B output directory on error:', m4bOutputContainingDir); } // Changed
           catch (e) { console.error("Error cleaning up M4B output directory during rejection:", e); } // Changed
        }
        rejectResponseInternal(errorResponse);
      };

      form.parse(mockReq, async (err, fields, files) => {
        if (err) {
          console.error('Formidable parsing error:', err);
          cleanupAndReject(NextResponse.json({ error: 'Error parsing form data.', details: err.message || String(err) }, { status: 500 }));
          return;
        }

        console.log('Formidable parsing complete. Fields:', Object.keys(fields), 'Files:', Object.keys(files));

        try {
            const bookTitle = getFirstField(fields.bookTitle as string | string[]);
            const author = getFirstField(fields.author as string | string[]);
            const chapterMetadataJson = getFirstField(fields.chapterMetadataJson as string | string[]);

            if (!bookTitle || !author || !chapterMetadataJson) {
              cleanupAndReject(NextResponse.json({ error: 'Missing required fields: bookTitle, author, or chapterMetadataJson' }, { status: 400 }));
              return;
            }

            let parsedChapterMetadata: Array<{ originalName: string; title: string }>;
            try {
                parsedChapterMetadata = JSON.parse(chapterMetadataJson);
            } catch (e) {
                console.error("Error parsing chapterMetadataJson:", e);
                cleanupAndReject(NextResponse.json({ error: 'Invalid chapterMetadataJson format.' }, { status: 400 }));
                return;
            }
            
            const chapterFilesInput: ChapterInput[] = [];
            const uploadedChapterFiles = files.chapterFiles;

            if (Array.isArray(uploadedChapterFiles)) {
                if (uploadedChapterFiles.length !== parsedChapterMetadata.length) {
                    cleanupAndReject(NextResponse.json({ error: 'Mismatch between number of chapter files and chapter metadata entries.' }, { status: 400 }));
                    return;
                }
                for (let i = 0; i < uploadedChapterFiles.length; i++) {
                    const file = uploadedChapterFiles[i];
                    if (file && file.filepath) {
                        chapterFilesInput.push({
                            path: file.filepath,
                            title: parsedChapterMetadata[i]?.title || `Chapter ${i+1}`,
                            originalName: file.originalFilename || parsedChapterMetadata[i]?.originalName || `UnknownFile_${i+1}`,
                        });
                    } else {
                         cleanupAndReject(NextResponse.json({ error: `Missing file data for chapter ${i + 1}` }, { status: 400 }));
                         return;
                    }
                }
            } else if (uploadedChapterFiles) { 
                const file = uploadedChapterFiles as FormidableFile;
                if (parsedChapterMetadata.length !== 1) {
                    cleanupAndReject(NextResponse.json({ error: 'Received single chapter file but multiple metadata entries.' }, { status: 400 }));
                    return;
                }
                if (file.filepath) {
                     chapterFilesInput.push({
                        path: file.filepath,
                        title: parsedChapterMetadata[0]?.title || 'Chapter 1',
                        originalName: file.originalFilename || parsedChapterMetadata[0]?.originalName || 'UnknownFile_1',
                    });
                } else {
                    cleanupAndReject(NextResponse.json({ error: 'Missing file path for single chapter file.' }, { status: 400 }));
                    return;
                }
            } else { 
                cleanupAndReject(NextResponse.json({ error: 'No chapter files uploaded.' }, { status: 400 }));
                return;
            }

            if (chapterFilesInput.length === 0) {
              cleanupAndReject(NextResponse.json({ error: 'No valid chapter files processed.' }, { status: 400 }));
              return;
            }
            
            const coverArtFile = files.coverArt ? (Array.isArray(files.coverArt) ? files.coverArt[0] : files.coverArt) : undefined;

            const audiobookMetadata: AudiobookMetadata = {
              bookTitle,
              author,
              coverArtPath: coverArtFile?.filepath,
              chapters: chapterFilesInput,
            };
            
            console.log('Starting M4B conversion with metadata:', JSON.stringify(audiobookMetadata, (key, value) => key === 'chapters' ? value.map((c: ChapterInput) => ({...c, path: '...', originalName: c.originalName})) : value, 2));
            
            const m4bFilePath = await convertToM4B(audiobookMetadata);
            m4bOutputContainingDir = path.dirname(m4bFilePath); // Capture the directory of the output M4B
            console.log('M4B file generated at:', m4bFilePath);

            const m4bFileName = path.basename(m4bFilePath);
            const stats = await fs.stat(m4bFilePath);
            const m4bFileSize = stats.size;

            const responseHeaders = new Headers();
            responseHeaders.set('Content-Type', 'audio/mp4a-latm'); // Standard M4B MIME type
            responseHeaders.set('Content-Disposition', `attachment; filename="${encodeURIComponent(m4bFileName)}"`);
            responseHeaders.set('Content-Length', m4bFileSize.toString());

            const nodeFileStream = fs.createReadStream(m4bFilePath);
            
            nodeFileStream.on('close', () => {
              console.log('M4B file stream closed. Cleaning up M4B output directory:', m4bOutputContainingDir);
              if (m4bOutputContainingDir) {
                fs.remove(m4bOutputContainingDir)
                  .then(() => console.log('Successfully cleaned up M4B output directory after streaming.'))
                  .catch(e => console.error("Error cleaning up M4B output directory after streaming:", e));
              }
            });

            nodeFileStream.on('error', (streamError) => {
                console.error('Error during M4B file streaming:', streamError);
                // Attempt cleanup even on stream error
                if (m4bOutputContainingDir) {
                    fs.remove(m4bOutputContainingDir)
                      .then(() => console.log('Successfully cleaned up M4B output directory after stream error.'))
                      .catch(e => console.error("Error cleaning up M4B output directory after stream error:", e));
                }
                // Note: We can't reject the main promise here as it might have already resolved.
                // The client will experience a broken download.
            });
            
            const webStream = Readable.toWeb(nodeFileStream);

            resolveResponse(new NextResponse(webStream, { status: 200, headers: responseHeaders }));
            
            // tempUploadDirPath (Formidable's upload dir) is cleaned up in the finally block below.
            // m4bOutputContainingDir is cleaned up by the stream's 'close' or 'error' event.

          } catch (processingError) {
            console.error('Error during M4B conversion processing:', processingError);
            const errorMessage = processingError instanceof Error ? processingError.message : 'An unknown error occurred during conversion.';
            cleanupAndReject(NextResponse.json({ error: errorMessage, details: String(processingError) }, { status: 500 }));
          } finally {
             // This finally block is for the try...catch within form.parse callback
             // It ensures Formidable's upload directory is cleaned up.
             if (tempUploadDirPath && await fs.pathExists(tempUploadDirPath)) { 
                fs.remove(tempUploadDirPath)
                .then(() => console.log('Cleaned up Formidable upload directory (form.parse finally):', tempUploadDirPath))
                .catch(e => console.error("Error cleaning up Formidable upload directory (form.parse finally):", e));
             }
          }
      });
    });

  } catch (error) { 
    console.error('Outer error/rejection in API route:', error);
    
    let responseError = 'Server setup error.';
    let responseDetails = 'Unknown error during initial setup or promise rejection.';
    let responseStatus = 500;

    if (error instanceof NextResponse) { 
        try {
            const errJson = await error.json(); 
            responseError = errJson.error || responseError;
            responseDetails = errJson.details || responseDetails;
            responseStatus = error.status || responseStatus;
        } catch (e) {
            console.error("Failed to parse JSON from rejected NextResponse in outer catch:", e);
        }
    } else if (error instanceof Error) {
        responseError = error.message; 
        responseDetails = String(error); // Keep it simple
    } else {
        responseDetails = String(error);
    }
    
    // Cleanup Formidable's temp upload dir if it exists and an outer error occurred
    if (tempUploadDirPath && await fs.pathExists(tempUploadDirPath)) {
      try { await fs.remove(tempUploadDirPath); console.log('Cleaned up Formidable upload directory (outer catch):', tempUploadDirPath); }
      catch (e) { console.error("Error cleaning up Formidable upload directory (outer catch):", e); }
    }
    // Cleanup M4B output dir if it exists and an outer error occurred
    if (m4bOutputContainingDir && await fs.pathExists(m4bOutputContainingDir)) {
      try { await fs.remove(m4bOutputContainingDir); console.log('Cleaned up M4B output directory (outer catch):', m4bOutputContainingDir); }
      catch (e) { console.error("Error cleaning up M4B output directory (outer catch):", e); }
    }

    return NextResponse.json({ error: responseError, details: responseDetails }, { status: responseStatus });
  } 
}
    
