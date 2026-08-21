"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { EventForm } from "@/components/EventForm";
import { ApiClientError, createEvent, type EventInput } from "@/lib/api/events";

export default function NewEventPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (input: EventInput) => createEvent(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      router.push("/events");
    },
    onError: (err) => {
      setError(err instanceof ApiClientError ? err.message : "Не удалось создать событие");
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Новое событие</h1>
      <EventForm
        onSubmit={async (input) => {
          setError(null);
          await mutation.mutateAsync(input);
        }}
        submitLabel="Создать"
        pending={mutation.isPending}
        submitError={error}
      />
    </div>
  );
}
