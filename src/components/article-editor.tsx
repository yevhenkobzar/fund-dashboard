"use client";

import { useState } from "react";
import { deleteArticle, saveArticle } from "@/server/mutations";
import { MarkdownView } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ArticleEditor({
  id,
  type,
  title,
  excerpt,
  content,
  published,
}: {
  id?: string;
  type: "MARKET_REVIEW" | "RESEARCH";
  title?: string;
  excerpt?: string;
  content?: string;
  published?: boolean;
}) {
  const [body, setBody] = useState(content ?? "");
  const [tab, setTab] = useState<"write" | "preview">("write");
  return (
    <div className="space-y-4">
      <form action={saveArticle} className="space-y-4">
        {id ? <input type="hidden" name="id" value={id} /> : null}
        <input type="hidden" name="type" value={type} />
        <div>
          <Label htmlFor="title">Title</Label>
          <Input id="title" name="title" defaultValue={title} required maxLength={200} />
        </div>
        <div>
          <Label htmlFor="excerpt">Excerpt</Label>
          <Textarea id="excerpt" name="excerpt" defaultValue={excerpt} placeholder="Optional. The first lines are used if you leave this blank." />
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setTab("write")} className={`rounded-full px-3 py-1 text-xs ${tab === "write" ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>Write</button>
          <button type="button" onClick={() => setTab("preview")} className={`rounded-full px-3 py-1 text-xs ${tab === "preview" ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>Preview</button>
        </div>
        {tab === "write" ? (
          <Textarea name="content" value={body} onChange={(event) => setBody(event.target.value)} className="min-h-[420px] font-mono text-[13px]" required />
        ) : (
          <div className="min-h-[420px] rounded-md border border-border bg-card p-4">
            <input type="hidden" name="content" value={body} />
            {body.trim() ? <MarkdownView content={body} /> : <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>}
          </div>
        )}
        <p className="text-sm text-muted-foreground">
          {published ? "Saving a draft takes this note off the published list." : "Viewers cannot see a draft."}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" name="intent" value="draft" variant="secondary">Save draft</Button>
          <Button type="submit" name="intent" value="publish">Publish</Button>
        </div>
      </form>
      {id ? (
        <form action={deleteArticle}>
          <input type="hidden" name="id" value={id} />
          <Button type="submit" variant="destructive">Delete</Button>
        </form>
      ) : null}
    </div>
  );
}
