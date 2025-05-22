
import { z } from 'zod';

const MAX_COVER_ART_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
// For audio types, ffmpeg is quite versatile, so we can be less strict here.
// The server-side will ultimately determine if ffmpeg can handle it.
// const ACCEPTED_AUDIO_TYPES = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/mp4', 'audio/m4a'];

export const chapterSchema = z.object({
  id: z.string(), // Used for React key, not directly sent to server in this new setup
  file: z.custom<File>((val) => val instanceof File, "A valid audio file is required for each chapter."),
  name: z.string(), // Original file name, for display and reference
  title: z.string().min(1, 'Chapter title is required.'),
});

export const audiobookFormSchema = z.object({
  bookTitle: z.string().min(1, 'Book title is required.'),
  author: z.string().min(1, 'Author is required.'),
  coverArt: z
    .custom<FileList>()
    .refine((fileList) => fileList === null || fileList === undefined || fileList.length <= 1, "Only one cover art image is allowed.")
    .transform(fileList => fileList?.[0]) 
    .refine((file) => !file || file.size <= MAX_COVER_ART_SIZE, `Max file size is 5MB.`)
    .refine(
      (file) => !file || ACCEPTED_IMAGE_TYPES.includes(file.type),
      'Only .jpg, .jpeg, .png, .webp formats are accepted for cover art.'
    )
    .nullable()
    .optional(),
  chapters: z.array(chapterSchema)
    .min(1, 'At least one audio chapter is required.')
    .refine(chapters => chapters.every(c => c.file instanceof File), "All chapters must have a valid audio file."),
});

export type AudiobookFormValues = z.infer<typeof audiobookFormSchema>;
