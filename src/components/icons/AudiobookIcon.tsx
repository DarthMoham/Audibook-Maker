import type { SVGProps } from 'react';

export function AudiobookIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
      <path d="M12 6v6l4 2" />
      <path d="M18 18.5a8 8 0 0 0-12 0" />
      <path d="M6 16.5c1.5-1 3.5-1.5 6-1.5s4.5.5 6 1.5" />
    </svg>
  );
}
