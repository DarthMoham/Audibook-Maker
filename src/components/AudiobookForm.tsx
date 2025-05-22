
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
import { UploadCloud, DownloadCloud, Trash2, Loader2, FileAudio, BookOpen } from 'lucide-react';

export default function AudiobookForm() {
  const { toast } = useToast();
  const [coverArtPreview, setCoverArtPreview] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [conversionProgress, setConversionProgress] = useState(0);
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
    keyName: "customId", // Keep this if you rely on it, otherwise 'id' is default
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
        id: crypto.randomUUID(), // Ensure unique ID for react key
        file: file,
        name: file.name,
        title: getFileNameWithoutExtension(file.name),
      } as ChapterClient )); // Make sure ChapterClient includes 'id'
      
      // Clear existing fields before appending to avoid issues if user selects files multiple times
      while(fields.length > 0) {
        remove(0);
      }
      newChapters.forEach(chapter => append(chapter));
    }
  };

  const onSubmit = async (data: AudiobookFormValues) => {
    setIsConverting(true);
    setM4bDownload(null);
    setConversionProgress(0);

    // Progress simulation
    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      if (progress <= 90) { // Simulate up to 90%, actual completion will set to 100
        setConversionProgress(progress);
      } else {
        // Don't clear interval here, wait for actual response
      }
    }, 300);

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

      clearInterval(interval);
      setConversionProgress(100);

      if (response.ok) {
        const blob = await response.blob();
        const contentDisposition = response.headers.get('content-disposition');
        let fileName = "audiobook.m4b"; // Default filename
        if (contentDisposition) {
          const fileNameMatch = contentDisposition.match(/filename="?(.+)"?/i);
          if (fileNameMatch && fileNameMatch.length > 1) {
            fileName = fileNameMatch[1];
          }
        }
        const url = window.URL.createObjectURL(blob);
        setM4bDownload({ url: url, fileName: fileName });
        toast({
          title: "Conversion Successful!",
          description: "Your M4B audiobook is ready for download.",
        });
      } else {
        const errorData = await response.json();
        toast({
          variant: "destructive",
          title: "Conversion Failed",
          description: errorData.error || "An error occurred during M4B conversion.",
        });
         console.error("Conversion failed with data:", errorData);
      }
    } catch (error) {
      clearInterval(interval);
      setConversionProgress(0); // Reset progress on network or other client-side error
      toast({
        variant: "destructive",
        title: "Conversion Error",
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
      console.error("Form submission error:", error);
    } finally {
      setIsConverting(false);
    }
  };
  
  // Clean up blob URL when component unmounts or download URL changes
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
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl flex items-center gap-2">
             <BookOpen className="h-8 w-8 text-primary" /> Book Details
          </CardTitle>
          <CardDescription>Provide the general information for your audiobook.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="bookTitle" className="text-lg">Book Title</Label>
            <Input id="bookTitle" {...form.register('bookTitle')} placeholder="e.g., The Great Adventure" className="text-base" />
            {form.formState.errors.bookTitle && <p className="text-sm text-destructive">{form.formState.errors.bookTitle.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="author" className="text-lg">Author</Label>
            <Input id="author" {...form.register('author')} placeholder="e.g., Jane Doe" className="text-base" />
            {form.formState.errors.author && <p className="text-sm text-destructive">{form.formState.errors.author.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="coverArt" className="text-lg">Cover Art (Optional)</Label>
            <Input
              id="coverArt"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleCoverArtChange}
              className="text-base"
            />
            {form.formState.errors.coverArt && <p className="text-sm text-destructive">{form.formState.errors.coverArt.message as string}</p>}
            {coverArtPreview && (
              <div className="mt-4">
                <Image src={coverArtPreview} alt="Cover art preview" width={200} height={200} className="rounded-md border shadow-md object-cover" data-ai-hint="book cover" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl flex items-center gap-2">
            <FileAudio className="h-8 w-8 text-primary" /> Chapters
          </CardTitle>
          <CardDescription>Upload your audio files. Each file will be treated as a chapter. Ensure files are in the desired chapter order.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label htmlFor="audioFiles" className="text-lg">Audio Files (MP3, WAV, M4A, OGG, etc.)</Label>
            <Input
              id="audioFiles"
              type="file"
              multiple
              accept="audio/*" // More generic audio/* but can be specific like audio/mpeg,audio/wav,audio/mp4
              onChange={handleAudioFilesChange}
              className="text-base"
            />
            {form.formState.errors.chapters && !fields.length && <p className="text-sm text-destructive">{form.formState.errors.chapters.message}</p>}
          </div>

          {fields.map((field, index) => {
            return (
            <Card key={field.customId} className="p-4 border-muted shadow-sm">
              <CardHeader className="p-2">
                <CardTitle className="text-xl flex justify-between items-center">
                  <span>Chapter {index + 1}: {field.name}</span>
                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} aria-label="Remove chapter">
                    <Trash2 className="h-5 w-5 text-destructive" />
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
                    className="text-sm"
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

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl">Create Audiobook</CardTitle>
        </CardHeader>
        <CardContent>
          {isConverting && (
            <div className="space-y-2">
              <p>Converting your audiobook... This may take a few minutes.</p>
              <Progress value={conversionProgress} className="w-full" />
            </div>
          )}
          {m4bDownload && (
            <div className="space-y-2">
              <p className="text-green-700 font-semibold">Audiobook ready!</p>
              <a
                href={m4bDownload.url} 
                download={m4bDownload.fileName}
              >
                <Button type="button" variant="default" className="bg-accent hover:bg-accent/90 text-accent-foreground w-full text-lg py-6">
                  <DownloadCloud className="mr-2 h-5 w-5" /> Download M4B File ({m4bDownload.fileName})
                </Button>
              </a>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isConverting || !fields.length} className="w-full text-lg py-6">
            {isConverting ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <UploadCloud className="mr-2 h-5 w-5" />
            )}
            {isConverting ? 'Processing...' : 'Create M4B Audiobook'}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}

