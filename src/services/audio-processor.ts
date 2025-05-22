
'use server';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs-extra';
import path from 'path';
import tmp from 'tmp';
import type { FfprobeData } from 'fluent-ffmpeg';

export interface ChapterInput {
  path: string;
  title: string;
  originalName: string; // For reference or ordering if needed
}

export interface AudiobookMetadata {
  bookTitle: string;
  author: string;
  coverArtPath?: string;
  chapters: ChapterInput[];
}

// Promisify ffprobe
function ffprobeAsync(filePath: string): Promise<FfprobeData> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) {
        return reject(err);
      }
      resolve(data);
    });
  });
}

async function createChapterMetadataFile(
  audiobookMeta: Pick<AudiobookMetadata, 'bookTitle' | 'author' | 'chapters'>,
  outputDir: string
): Promise<string> {
  let metadataContent = ';FFMETADATA1\n';
  metadataContent += `title=${audiobookMeta.bookTitle}\n`;
  metadataContent += `artist=${audiobookMeta.author}\n`;
  metadataContent += `album=${audiobookMeta.bookTitle}\n`; // Often same as title for audiobooks
  metadataContent += `genre=Audiobook\n`;
  metadataContent += `date=${new Date().getFullYear()}\n\n`;

  let currentTimeMs = 0;
  for (const chapter of audiobookMeta.chapters) {
    try {
      const probeData = await ffprobeAsync(chapter.path);
      const durationMs = Math.round((probeData.format.duration || 0) * 1000);

      metadataContent += `[CHAPTER]\n`;
      metadataContent += `TIMEBASE=1/1000\n`;
      metadataContent += `START=${currentTimeMs}\n`;
      currentTimeMs += durationMs;
      metadataContent += `END=${currentTimeMs}\n`;
      metadataContent += `title=${chapter.title}\n\n`;
    } catch (error) {
      console.error(`Error probing file ${chapter.originalName}:`, error);
      throw new Error(`Failed to probe chapter file: ${chapter.originalName}. ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const metadataFilePath = path.join(outputDir, 'ffmpeg_metadata.txt');
  await fs.writeFile(metadataFilePath, metadataContent);
  return metadataFilePath;
}

export async function convertToM4B(metadata: AudiobookMetadata): Promise<string> {
  return new Promise<string>(async (resolve, reject) => {
    const tempProcessingDirObj = tmp.dirSync({ unsafeCleanup: true });
    const tempProcessingDir = tempProcessingDirObj.name;
    console.log('Created temp processing directory for ffmpeg:', tempProcessingDir);

    const outputFileName = `${metadata.bookTitle.replace(/[\s:]+/g, '_')}_Audiobook.m4b`;
    const outputM4BPath = path.join(tempProcessingDir, outputFileName);

    let tempCoverPath: string | undefined;

    try {
      const command = ffmpeg();

      // 1. Add all chapter audio files as inputs
      metadata.chapters.forEach(chapter => {
        command.input(chapter.path);
      });
      const audioInputsCount = metadata.chapters.length;

      // 2. Prepare cover art if provided and add as input
      let coverArtInputIndex = -1;
      if (metadata.coverArtPath) {
        const coverExt = path.extname(metadata.coverArtPath);
        tempCoverPath = path.join(tempProcessingDir, `cover${coverExt}`);
        await fs.copy(metadata.coverArtPath, tempCoverPath);
        command.input(tempCoverPath);
        coverArtInputIndex = audioInputsCount; // Input index after all audio files
      }

      // 3. Create FFMPEG metadata file and add as input
      const ffmpegMetadataFilePath = await createChapterMetadataFile(
        {
          bookTitle: metadata.bookTitle,
          author: metadata.author,
          chapters: metadata.chapters,
        },
        tempProcessingDir 
      );
      command.input(ffmpegMetadataFilePath);
      const metadataFileInputIndex = audioInputsCount + (tempCoverPath ? 1 : 0);

      // 4. Build complex filter for audio concatenation
      const audioConcatFilter = metadata.chapters
        .map((_, index) => `[${index}:a]`)
        .join('') + `concat=n=${audioInputsCount}:v=0:a=1[a_out]`;
      
      command.complexFilter(audioConcatFilter);

      // 5. Configure output options
      const outputOptions: string[] = [
        '-map', '[a_out]', // Map the concatenated audio stream
        '-c:a', 'aac',    // AAC audio codec for M4B
        '-b:a', '128k',   // Audio bitrate
      ];

      if (tempCoverPath && coverArtInputIndex !== -1) {
        outputOptions.push(
          '-map', `${coverArtInputIndex}:v?`, 
          '-c:v', 'copy',                   
          '-disposition:v', 'attached_pic'
        );
      }
      
      outputOptions.push(`-map_metadata`, `${metadataFileInputIndex}`);
      command.outputOptions(outputOptions);
      command.output(outputM4BPath);

      command
        .on('start', (commandLine) => {
          console.log('Spawned Ffmpeg with command: ' + commandLine);
        })
        .on('progress', (progress) => {
          // Removed console.log for ffmpeg progress percentage
          // if (progress.percent) {
          //   console.log(`Processing: ${progress.percent}% done`);
          // }
        })
        .on('error', (err, stdout, stderr) => {
          console.error('ffmpeg stdout:', stdout);
          console.error('ffmpeg stderr:', stderr);
          if (tempProcessingDir) { // Ensure cleanup on error
            fs.remove(tempProcessingDir)
              .then(() => console.log('Cleaned up ffmpeg processing directory on error:', tempProcessingDir))
              .catch(e => console.error("Error cleaning up ffmpeg processing directory during error handling:", e));
          }
          reject(new Error(`ffmpeg error: ${err.message}`));
        })
        .on('end', (stdout, stderr) => {
          console.log('ffmpeg conversion finished successfully.');
          // console.log('ffmpeg stdout (end):', stdout); // Can be verbose
          // console.log('ffmpeg stderr (end):', stderr); // Can be verbose
          resolve(outputM4BPath); 
        })
        .run();

    } catch (error) {
      if (tempProcessingDir) { // Ensure cleanup on outer catch
        fs.remove(tempProcessingDir)
          .then(() => console.log('Cleaned up ffmpeg processing directory on outer catch:', tempProcessingDir))
          .catch(e => console.error("Error cleaning up ffmpeg processing directory during outer catch:", e));
      }
      reject(error);
    }
  });
}
