
import type { z } from 'zod';
import type { audiobookFormSchema, chapterSchema } from '@/lib/validation';

export type ChapterClient = {
  id: string;
  file: File;
  name: string;
  title: string;
};

export type AudiobookFormData = z.infer<typeof audiobookFormSchema>;
export type ChapterFormData = z.infer<typeof chapterSchema>;

export interface ServerActionResponse<T = null> {
  success: boolean;
  data?: T;
  error?: string | { [key: string]: string[] } | null;
}
