
"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { convertToM4BAction } from '@/app/actions';
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
    if (lastDotIndex === -1) return fileName; // No extension found
    return fileName.substring(0, lastDotIndex);
  };

  const handleAudioFilesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const newChapters = Array.from(files).map(file => ({
        id: crypto.randomUUID(),
        file: file,
        name: file.name,
        title: getFileNameWithoutExtension(file.name), // Prefill title
      } as ChapterClient ));
      
      // Clear existing fields before appending new ones to avoid duplicates if user selects files multiple times
      fields.forEach((_, index) => remove(index)); 
      newChapters.forEach(chapter => append(chapter));
    }
  };

  const onSubmit = async (data: AudiobookFormValues) => {
    setIsConverting(true);
    setM4bDownload(null);
    setConversionProgress(0);

    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      if (progress <= 100) {
        setConversionProgress(progress);
      } else {
        clearInterval(interval);
      }
    }, 300);


    const formDataToSubmit = new FormData();
    formDataToSubmit.append('bookTitle', data.bookTitle);
    formDataToSubmit.append('author', data.author);
    if (data.coverArt?.[0]) {
      formDataToSubmit.append('coverArt', data.coverArt[0]);
    }
    formDataToSubmit.append('chapters', JSON.stringify(data.chapters.map(c => ({ name: c.name, title: c.title }))));
    

    const response = await convertToM4BAction(formDataToSubmit);
    clearInterval(interval); 
    setConversionProgress(100);


    if (response.success && response.data?.downloadUrl) {
      setM4bDownload({ url: response.data.downloadUrl, fileName: response.data.fileName });
      toast({
        title: "Conversion Successful!",
        description: "Your M4B audiobook is ready for download.",
      });
    } else {
      toast({
        variant: "destructive",
        title: "Conversion Failed",
        description: response.error?.toString() || "An error occurred during M4B conversion.",
      });
    }
    setIsConverting(false);
  };
  
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
            <Label htmlFor="coverArt" className="text-lg">Cover Art</Label>
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
          <CardDescription>Upload your audio files. Each file will be treated as a chapter.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label htmlFor="audioFiles" className="text-lg">Audio Files</Label>
            <Input
              id="audioFiles"
              type="file"
              multiple
              accept="audio/mpeg,audio/wav,audio/mp3,audio/m4a,audio/mp4"
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
              <p>Converting your audiobook... Please wait.</p>
              <Progress value={conversionProgress} className="w-full" />
            </div>
          )}
          {m4bDownload && (
            <div className="space-y-2">
              <p className="text-green-700 font-semibold">Audiobook ready!</p>
              <a
                href={m4bDownload.url} 
                download={m4bDownload.fileName}
                onClick={(e) => {
                  if (m4bDownload.url.startsWith('/placeholder-audiobooks/')) {
                    e.preventDefault();
                    toast({ title: "Download Simulated", description: `This is a placeholder. In a real app, ${m4bDownload.fileName} would download.`});
                  }
                }}
              >
                <Button variant="default" className="bg-accent hover:bg-accent/90 text-accent-foreground w-full text-lg py-6">
                  <DownloadCloud className="mr-2 h-5 w-5" /> Download M4B File
                </Button>
              </a>
              <p className="text-xs text-muted-foreground text-center">Note: This is a simulated download. File: {m4bDownload.fileName}</p>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isConverting} className="w-full text-lg py-6">
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

