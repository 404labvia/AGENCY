"use client";

import InteractiveAvatar from "@/components/InteractiveAvatar";

export default function Home() {
  return (
    // Rimuoviamo il padding e la width fissa per permettere il layout full-screen
    <div className="w-screen h-screen">
      {/* Rimuoviamo i constraints di width e padding */}
      <div className="h-full">
        <InteractiveAvatar />
      </div>
    </div>
  );
}