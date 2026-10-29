"use client";

export default function DeskError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="max-w-lg">
      <h1 className="font-serif text-3xl">The desk hit a snag</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">Reload this view. If a trade was refused, the book was left unchanged.</p>
      <button type="button" onClick={reset} className="mt-4 text-sm text-primary underline">Try again</button>
    </div>
  );
}
