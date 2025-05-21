
import { z } from 'zod';

const MAX_COVER_ART_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const ACCEPTED_AUDIO_TYPES = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/mp4', 'audio/m4a'];

export const chapterSchema = z.object({
  id: z.string(),
  file: z.custom<File>((val) => val instanceof File, "Invalid file provided"),
  name: z.string(), 
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
      'Only .jpg, .jpeg, .png, .webp formats are accepted.'
    )
    .nullable()
    .optional(),
  chapters: z.array(chapterSchema).min(1, 'At least one audio chapter is required.'),
});

export type AudiobookFormValues = z.infer<typeof audiobookFormSchema>;
