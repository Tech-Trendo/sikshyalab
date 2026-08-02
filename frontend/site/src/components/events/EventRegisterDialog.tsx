"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EventRegistrationForm } from "@/components/events/EventRegistrationForm";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventSlug: string;
  eventTitle: string;
};

export function EventRegisterDialog({
  open,
  onOpenChange,
  eventSlug,
  eventTitle,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto border border-brand-border bg-white shadow-brand-med !backdrop-blur-none [background:white]">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl font-bold text-brand-navy-dark">
            Register Now
          </DialogTitle>
          <DialogDescription className="text-sm text-brand-body">
            Register for {eventTitle}. After admin approval, event details will
            be sent to your email.
          </DialogDescription>
        </DialogHeader>
        <EventRegistrationForm
          eventSlug={eventSlug}
          eventTitle={eventTitle}
          idPrefix="popup-event-reg"
          onSuccess={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
