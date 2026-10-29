"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

export function VoidButton({
  action,
  id,
  field = "id",
  label = "Void",
  title,
  body,
}: {
  action: (formData: FormData) => void | Promise<void>;
  id: string;
  field?: string;
  label?: string;
  title: string;
  body: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="text-sm text-danger hover:underline">{label}</button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle className="font-serif text-2xl">{title}</DialogTitle>
          <DialogDescription className="mt-2 text-sm leading-6 text-muted-foreground">{body}</DialogDescription>
          <form action={action} className="mt-5 flex gap-2">
            <input type="hidden" name={field} value={id} />
            <Button type="submit" variant="destructive">Confirm</Button>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
