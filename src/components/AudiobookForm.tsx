
"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import type { ChapterClient } from '@/lib/types';
import { audiobookFormSchema, type AudiobookFormValues } from '@/lib/validation';
import { UploadCloud, DownloadCloud, Trash2, Loader2, FileAudio, BookOpen, Wand2 } from 'lucide-react';

export default function AudiobookForm() {
  const { toast } = useToast();
  const [coverArtPreview, setCoverArtPreview] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [conversionProgress, setConversionProgress] = useState(0);
  const [conversionStageMessage, setConversionStageMessage] = useState('');
  const [m4bDownload, setM4bDownload] = useState<{ url: string; fileName: string } | null>(null);

  const form = useForm<AudiobookFormValues>({
    resolver: zodResolver(audiobookFormSchema),
    defaultValues: {
      bookTitle: '',
      author: '',
      coverArt: undefined,
      chapters: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "chapters",
    keyName: "customId",
  });

  const handleCoverArtChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCoverArtPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      form.setValue('coverArt', event.target.files); 
    } else {
      setCoverArtPreview(null);
      form.setValue('coverArt', undefined);
    }
  };

  const getFileNameWithoutExtension = (fileName: string) => {
    const lastDotIndex = fileName.lastIndexOf('.');
    if (lastDotIndex === -1) return fileName;
    return fileName.substring(0, lastDotIndex);
  };

  const handleAudioFilesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const newChapters = Array.from(files).map(file => ({
        id: crypto.randomUUID(),
        file: file,
        name: file.name,
        title: getFileNameWithoutExtension(file.name),
      } as ChapterClient ));
      
      while(fields.length > 0) {
        remove(0);
      }
      newChapters.forEach(chapter => append(chapter));
    }
  };

  useEffect(() => {
    if (isConverting) {
      if (conversionProgress === 0) setConversionStageMessage('Initializing conversion...');
      else if (conversionProgress > 0 && conversionProgress <= 20) setConversionStageMessage('Preparing chapter data...');
      else if (conversionProgress > 20 && conversionProgress <= 70) setConversionStageMessage('Converting audio (this may take a while)...');
      else if (conversionProgress > 70 && conversionProgress <= 95) setConversionStageMessage('Embedding metadata & cover art...');
      else if (conversionProgress > 95 && conversionProgress < 100) setConversionStageMessage('Finalizing M4B file...');
    }
  }, [conversionProgress, isConverting]);

  const onSubmit = async (data: AudiobookFormValues) => {
    setIsConverting(true);
    setM4bDownload(null);
    setConversionProgress(0); // Initial progress
    setConversionStageMessage('Starting upload...');


    // Progress simulation
    let progressInterval: NodeJS.Timeout | null = null;
    
    // Simulate initial upload and server prep phase (client-side)
    // We'll run this until the actual fetch starts, then rely on a longer, slower interval for conversion
    let initialProgress = 0;
    const initialInterval = setInterval(() => {
      initialProgress += 5; // Faster initial progress
      if (initialProgress <= 10) { // e.g. "uploading" and "server preparing"
        setConversionProgress(initialProgress);
         if(initialProgress <=5) setConversionStageMessage('Uploading files...');
         else setConversionStageMessage('Server is preparing...');
      } else {
        clearInterval(initialInterval);
        // Now start a slower interval for the main conversion simulation
        let mainConversionSimulatedProgress = initialProgress;
        progressInterval = setInterval(() => {
          mainConversionSimulatedProgress += 2; // Slower progress for conversion
          if (mainConversionSimulatedProgress <= 95) { // Simulate up to 95% for conversion phase
            setConversionProgress(mainConversionSimulatedProgress);
          } else {
             if(progressInterval) clearInterval(progressInterval); // Stop at 95%, server response will take it to 100%
          }
        }, 800); // Slower interval
      }
    }, 200);


    const formDataToSubmit = new FormData();
    formDataToSubmit.append('bookTitle', data.bookTitle);
    formDataToSubmit.append('author', data.author);
    if (data.coverArt?.[0]) {
      formDataToSubmit.append('coverArt', data.coverArt[0], data.coverArt[0].name);
    }

    const chapterMetadata = data.chapters.map(c => ({
      originalName: c.name,
      title: c.title,
    }));
    formDataToSubmit.append('chapterMetadataJson', JSON.stringify(chapterMetadata));

    data.chapters.forEach((chapter) => {
      formDataToSubmit.append('chapterFiles', chapter.file, chapter.file.name);
    });
    
    try {
      const response = await fetch('/api/convert', {
        method: 'POST',
        body: formDataToSubmit,
      });

      if(initialInterval) clearInterval(initialInterval); // Clear initial if it was somehow still running
      if(progressInterval) clearInterval(progressInterval); // Clear main simulation interval

      if (response.ok) {
        setConversionProgress(100);
        setConversionStageMessage('Conversion Successful!');
        const blob = await response.blob();
        const contentDisposition = response.headers.get('content-disposition');
        let fileName = "audiobook.m4b";
        if (contentDisposition) {
          const fileNameMatch = contentDisposition.match(/filename="?(.+)"?/i);
          if (fileNameMatch && fileNameMatch.length > 1) {
            fileName = decodeURIComponent(fileNameMatch[1].replace(/['"]/g, ''));
          }
        }
        const url = window.URL.createObjectURL(blob);
        setM4bDownload({ url: url, fileName: fileName });
        toast({
          title: "Conversion Successful!",
          description: "Your M4B audiobook is ready for download.",
        });
      } else {
        setConversionProgress(0); // Reset on error
        const errorData = await response.json();
        setConversionStageMessage(`Conversion Failed: ${errorData.error || 'Unknown server error'}`);
        toast({
          variant: "destructive",
          title: "Conversion Failed",
          description: errorData.error || "An error occurred during M4B conversion.",
        });
         console.error("Conversion failed with data:", errorData);
      }
    } catch (error) {
      if(initialInterval) clearInterval(initialInterval);
      if(progressInterval) clearInterval(progressInterval);
      setConversionProgress(0); 
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
      setConversionStageMessage(`Conversion Error: ${errorMessage}`);
      toast({
        variant: "destructive",
        title: "Client-side Conversion Error",
        description: errorMessage,
      });
      console.error("Form submission error:", error);
    } finally {
      setIsConverting(false);
      // Don't reset progress to 0 here if successful, let it stay at 100%
      // If error, it's already set to 0 or an error message state
    }
  };
  
  useEffect(() => {
    const currentUrl = m4bDownload?.url;
    return () => {
      if (currentUrl) {
        window.URL.revokeObjectURL(currentUrl);
      }
    };
  }, [m4bDownload?.url]);

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
      <Card className="shadow-lg rounded-xl overflow-hidden">
        <CardHeader className="bg-primary/10">
          <CardTitle className="text-3xl flex items-center gap-2 text-primary">
             <BookOpen className="h-8 w-8" /> Book Details
          </CardTitle>
          <CardDescription className="text-muted-foreground">Provide the general information for your audiobook.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 p-6">
          <div className="space-y-2">
            <Label htmlFor="bookTitle" className="text-lg font-semibold">Book Title</Label>
            <Input id="bookTitle" {...form.register('bookTitle')} placeholder="e.g., The Great Adventure" className="text-base rounded-md shadow-sm" />
            {form.formState.errors.bookTitle && <p className="text-sm text-destructive">{form.formState.errors.bookTitle.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="author" className="text-lg font-semibold">Author</Label>
            <Input id="author" {...form.register('author')} placeholder="e.g., Jane Doe" className="text-base rounded-md shadow-sm" />
            {form.formState.errors.author && <p className="text-sm text-destructive">{form.formState.errors.author.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="coverArt" className="text-lg font-semibold">Cover Art (Optional)</Label>
            <Input
              id="coverArt"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleCoverArtChange}
              className="text-base file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/20 file:text-primary hover:file:bg-primary/30 rounded-md shadow-sm"
            />
            {form.formState.errors.coverArt && <p className="text-sm text-destructive">{form.formState.errors.coverArt.message as string}</p>}
            {coverArtPreview && (
              <div className="mt-4">
                <Image src={coverArtPreview} alt="Cover art preview" width={200} height={200} className="rounded-lg border-2 border-muted shadow-md object-cover" data-ai-hint="book cover" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg rounded-xl overflow-hidden">
        <CardHeader className="bg-primary/10">
          <CardTitle className="text-3xl flex items-center gap-2 text-primary">
            <FileAudio className="h-8 w-8" /> Chapters
          </CardTitle>
          <CardDescription className="text-muted-foreground">Upload your audio files. Each file will be treated as a chapter. Ensure files are in the desired chapter order.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 p-6">
          <div>
            <Label htmlFor="audioFiles" className="text-lg font-semibold">Audio Files (MP3, WAV, M4A, OGG, etc.)</Label>
            <Input
              id="audioFiles"
              type="file"
              multiple
              accept="audio/*"
              onChange={handleAudioFilesChange}
              className="text-base file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/20 file:text-primary hover:file:bg-primary/30 rounded-md shadow-sm"
            />
            {form.formState.errors.chapters && !fields.length && <p className="text-sm text-destructive">{form.formState.errors.chapters.message}</p>}
          </div>

          {fields.map((field, index) => {
            return (
            <Card key={field.customId} className="p-4 border-muted shadow-sm rounded-lg bg-background/50">
              <CardHeader className="p-2">
                <CardTitle className="text-xl flex justify-between items-center font-semibold">
                  <span>Chapter {index + 1}: {field.name}</span>
                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} aria-label="Remove chapter" className="text-destructive hover:bg-destructive/10 rounded-full">
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-2">
                <div className="space-y-1">
                  <Label htmlFor={`chapters.${index}.title`} className="text-base">Chapter Title</Label>
                  <Input
                    id={`chapters.${index}.title`}
                    {...form.register(`chapters.${index}.title`)}
                    placeholder="Enter chapter title"
                    className="text-sm rounded-md"
                  />
                  {form.formState.errors.chapters?.[index]?.title && (
                    <p className="text-xs text-destructive">{form.formState.errors.chapters[index]?.title?.message}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )})}
        </CardContent>
      </Card>

      <Card className="shadow-lg rounded-xl overflow-hidden">
        <CardHeader className="bg-primary/10">
          <CardTitle className="text-3xl flex items-center gap-2 text-primary">
             <Wand2 className="h-8 w-8"/> Create Audiobook
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {(isConverting || m4bDownload || conversionProgress > 0 ) && ( // Show progress area if converting OR download is ready OR an error occurred (progress might be 0 but stage message set)
            <div className="space-y-3 my-4">
              <p className="font-semibold text-lg text-center">{conversionStageMessage}</p>
              <Progress value={conversionProgress} className="w-full h-3 rounded-full [&>div]:bg-accent" />
            </div>
          )}
          {m4bDownload && !isConverting && (
            <div className="space-y-4 mt-4">
              <a
                href={m4bDownload.url} 
                download={m4bDownload.fileName}
                className="block w-full"
              >
                <Button type="button" variant="default" className="bg-accent hover:bg-accent/90 text-accent-foreground w-full text-lg py-6 rounded-md shadow-md">
                  <DownloadCloud className="mr-2 h-6 w-6" /> Download M4B: {m4bDownload.fileName}
                </Button>
              </a>
            </div>
          )}
        </CardContent>
        <CardFooter className="p-6 bg-muted/30">
          <Button type="submit" disabled={isConverting || !fields.length} className="w-full text-lg py-6 rounded-md shadow-lg hover:shadow-xl transition-shadow duration-300">
            {isConverting ? (
              <Loader2 className="mr-2 h-6 w-6 animate-spin" />
            ) : (
              <UploadCloud className="mr-2 h-6 w-6" />
            )}
            {isConverting ? 'Processing...' : (fields.length ? 'Start Conversion' : 'Add Chapters to Convert')}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
