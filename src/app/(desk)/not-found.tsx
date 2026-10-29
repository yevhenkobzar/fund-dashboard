import Link from "next/link";

export default function NotFound() {
  return (
    <div>
      <h1 className="font-serif text-4xl">Not in the desk</h1>
      <p className="mt-2 text-sm text-muted-foreground">That page is not available.</p>
      <Link href="/" className="mt-4 inline-block text-sm text-primary">Back to the overview</Link>
    </div>
  );
}
