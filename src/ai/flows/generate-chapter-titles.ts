'use server';
/**
 * @fileOverview Generates chapter titles from audio content.
 *
 * - generateChapterTitles - A function that generates chapter titles from audio content.
 * - GenerateChapterTitlesInput - The input type for the generateChapterTitles function.
 * - GenerateChapterTitlesOutput - The return type for the generateChapterTitles function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateChapterTitlesInputSchema = z.object({
  audioContentDescription: z
    .string()
    .describe('A description of the audio content for a chapter.'),
});
export type GenerateChapterTitlesInput = z.infer<typeof GenerateChapterTitlesInputSchema>;

const GenerateChapterTitlesOutputSchema = z.object({
  chapterTitle: z.string().describe('The generated chapter title.'),
});
export type GenerateChapterTitlesOutput = z.infer<typeof GenerateChapterTitlesOutputSchema>;

export async function generateChapterTitles(input: GenerateChapterTitlesInput): Promise<GenerateChapterTitlesOutput> {
  return generateChapterTitlesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateChapterTitlesPrompt',
  input: {schema: GenerateChapterTitlesInputSchema},
  output: {schema: GenerateChapterTitlesOutputSchema},
  prompt: `You are an expert audiobook chapter title generator.

  Based on the audio content description provided, generate an appropriate chapter title.

  Audio Content Description: {{{audioContentDescription}}}`,
});

const generateChapterTitlesFlow = ai.defineFlow(
  {
    name: 'generateChapterTitlesFlow',
    inputSchema: GenerateChapterTitlesInputSchema,
    outputSchema: GenerateChapterTitlesOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
