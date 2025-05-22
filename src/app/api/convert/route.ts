
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { IncomingForm, type File as FormidableFile } from 'formidable';
import fs from 'fs-extra';
import path from 'path';
import tmp from 'tmp';
import { Readable } from 'stream'; 

import { convertToM4B, type ChapterInput, type AudiobookMetadata } from '@/services/audio-processor';

export const config = {
  api: {
    bodyParser: false, 
  },
};

const getFirstField = (fieldValue: string | string[] | undefined): string | undefined => {
  if (Array.isArray(fieldValue)) {
    return fieldValue[0];
  }
  return fieldValue;
};

export async function POST(req: NextRequest) {
  let tempUploadDirPath: string | null = null; 
  let m4bOutputContainingDir: string | null = null; 

  try {
    const tempDirObject = tmp.dirSync({ unsafeCleanup: true });
    tempUploadDirPath = tempDirObject.name;
    console.log('Created temp upload directory for Formidable:', tempUploadDirPath);

    const form = new IncomingForm({
      uploadDir: tempUploadDirPath,
      keepExtensions: true,
      multiples: true, // Keep true as chapterFiles is multiple
      maxFileSize: 2000 * 1024 * 1024, // 2GB
      maxFieldsSize: 100 * 1024 * 1024, // 100MB for text fields
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
        if (tempUploadDirPath && await fs.pathExists(tempUploadDirPath)) {
          try { await fs.remove(tempUploadDirPath); console.log('Cleaned up Formidable upload directory on error:', tempUploadDirPath); }
          catch (e) { console.error("Error cleaning up Formidable upload directory during rejection:", e); }
        }
        if (m4bOutputContainingDir && await fs.pathExists(m4bOutputContainingDir)) { 
           try { await fs.remove(m4bOutputContainingDir); console.log('Cleaned up M4B output directory on error:', m4bOutputContainingDir); } 
           catch (e) { console.error("Error cleaning up M4B output directory during rejection:", e); } 
        }
        rejectResponseInternal(errorResponse);
      };

      form.parse(mockReq, async (err, fields, files) => {
        if (err) {
          console.error('Formidable parsing error:', err);
          cleanupAndReject(NextResponse.json({ error: 'Error parsing form data.', details: err.message || String(err) }, { status: 500 }));
          return;
        }

        console.log('Formidable parsing complete. Fields:', Object.keys(fields));
        console.log('Parsed files from Formidable (field names):', Object.keys(files));
        console.log('Detailed files from Formidable:', JSON.stringify(files, (key, value) => {
            if (value && typeof value === 'object' && (value as FormidableFile).filepath) {
                const f = value as FormidableFile;
                return { originalFilename: f.originalFilename, newFilename: f.newFilename, filepath: 'PRESENT', size: f.size, mimetype: f.mimetype };
            }
            if (Array.isArray(value) && value.every(item => item && typeof item === 'object' && (item as FormidableFile).filepath)) {
                return value.map(f => ({ originalFilename: f.originalFilename, newFilename: f.newFilename, filepath: 'PRESENT', size: f.size, mimetype: f.mimetype }));
            }
            return value;
        }, 2));


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
            } else if (uploadedChapterFiles && (uploadedChapterFiles as FormidableFile).filepath) { 
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
                cleanupAndReject(NextResponse.json({ error: 'No chapter files uploaded or files are invalid.' }, { status: 400 }));
                return;
            }

            if (chapterFilesInput.length === 0) {
              cleanupAndReject(NextResponse.json({ error: 'No valid chapter files processed.' }, { status: 400 }));
              return;
            }
            
            const coverArtFormidableFile = files.coverArt ? (Array.isArray(files.coverArt) ? files.coverArt[0] : files.coverArt as FormidableFile) : undefined;
            const coverArtPath = coverArtFormidableFile?.filepath;


            const audiobookMetadata: AudiobookMetadata = {
              bookTitle,
              author,
              coverArtPath: coverArtPath,
              chapters: chapterFilesInput,
            };
            
            console.log('Starting M4B conversion with metadata (coverArtPath included):', JSON.stringify(
              { ...audiobookMetadata, coverArtPath: coverArtPath ? 'PRESENT' : 'ABSENT', chapters: audiobookMetadata.chapters.map(c => ({title: c.title, originalName: c.originalName, pathPresent: !!c.path})) }, null, 2)
            );
            
            const m4bFilePath = await convertToM4B(audiobookMetadata);
            m4bOutputContainingDir = path.dirname(m4bFilePath); 
            console.log('M4B file generated at:', m4bFilePath);

            const m4bFileName = path.basename(m4bFilePath);
            const stats = await fs.stat(m4bFilePath);
            const m4bFileSize = stats.size;

            const responseHeaders = new Headers();
            responseHeaders.set('Content-Type', 'audio/mp4a-latm'); 
            responseHeaders.set('Content-Disposition', `attachment; filename="${encodeURIComponent(m4bFileName)}"`);
            responseHeaders.set('Content-Length', m4bFileSize.toString());

            const nodeFileStream = fs.createReadStream(m4bFilePath);
            
            nodeFileStream.on('close', async () => {
              console.log('M4B file stream closed. Cleaning up M4B output directory:', m4bOutputContainingDir);
              if (m4bOutputContainingDir && await fs.pathExists(m4bOutputContainingDir)) {
                fs.remove(m4bOutputContainingDir)
                  .then(() => console.log('Successfully cleaned up M4B output directory after streaming.'))
                  .catch(e => console.error("Error cleaning up M4B output directory after streaming:", e));
              }
            });

            nodeFileStream.on('error', async (streamError) => {
                console.error('Error during M4B file streaming:', streamError);
                if (m4bOutputContainingDir && await fs.pathExists(m4bOutputContainingDir)) {
                    fs.remove(m4bOutputContainingDir)
                      .then(() => console.log('Successfully cleaned up M4B output directory after stream error.'))
                      .catch(e => console.error("Error cleaning up M4B output directory after stream error:", e));
                }
            });
            
            const webStream = Readable.toWeb(nodeFileStream);
            resolveResponse(new NextResponse(webStream, { status: 200, headers: responseHeaders }));
            
          } catch (processingError) {
            console.error('Error during M4B conversion processing:', processingError);
            const errorMessage = processingError instanceof Error ? processingError.message : 'An unknown error occurred during conversion.';
            cleanupAndReject(NextResponse.json({ error: errorMessage, details: String(processingError) }, { status: 500 }));
          } finally {
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
        responseDetails = String(error); 
    } else {
        responseDetails = String(error);
    }
    
    if (tempUploadDirPath && await fs.pathExists(tempUploadDirPath)) {
      try { await fs.remove(tempUploadDirPath); console.log('Cleaned up Formidable upload directory (outer catch):', tempUploadDirPath); }
      catch (e) { console.error("Error cleaning up Formidable upload directory (outer catch):", e); }
    }
    if (m4bOutputContainingDir && await fs.pathExists(m4bOutputContainingDir)) {
      try { await fs.remove(m4bOutputContainingDir); console.log('Cleaned up M4B output directory (outer catch):', m4bOutputContainingDir); }
      catch (e) { console.error("Error cleaning up M4B output directory (outer catch):", e); }
    }

    return NextResponse.json({ error: responseError, details: responseDetails }, { status: responseStatus });
  } 
}
