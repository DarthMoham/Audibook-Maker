import AudiobookForm from '@/components/AudiobookForm';
import { AudiobookIcon } from '@/components/icons/AudiobookIcon';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-primary text-primary-foreground py-6 shadow-md">
        <div className="container mx-auto px-4 md:px-6 flex items-center gap-3">
          <AudiobookIcon className="h-10 w-10" />
          <h1 className="text-4xl font-bold tracking-tight" style={{ fontFamily: 'Georgia, Times New Roman, serif' }}>
            Audiobook Alchemist
          </h1>
        </div>
      </header>

      <main className="flex-grow container mx-auto p-4 md:p-8">
        <AudiobookForm />
      </main>

      <footer className="bg-muted text-muted-foreground py-6 mt-12">
        <div className="container mx-auto px-4 md:px-6 text-center">
          <p className="text-sm">
            &copy; {new Date().getFullYear()} Audiobook Alchemist. All rights reserved.
          </p>
          <p className="text-xs mt-1">
            Create your own chapterised M4B audiobooks with ease.
          </p>
        </div>
      </footer>
    </div>
  );
}
