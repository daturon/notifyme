"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { EventForm } from "@/components/EventForm";
import { ApiClientError, getEvent, updateEvent, type EventInput } from "@/lib/api/events";

export default function EditEventPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const eventQuery = useQuery({
    queryKey: ["events", id],
    queryFn: () => getEvent(id),
  });

  const mutation = useMutation({
    mutationFn: (input: EventInput) => updateEvent(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      router.push("/events");
    },
    onError: (err) => {
      setError(err instanceof ApiClientError ? err.message : "Не удалось сохранить событие");
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Редактирование события</h1>

      {eventQuery.isLoading && <p className="text-sm text-zinc-500">Загрузка…</p>}

      {eventQuery.isError && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          Не удалось загрузить событие
        </p>
      )}

      {eventQuery.data && (
        <EventForm
          event={eventQuery.data.event}
          onSubmit={async (input) => {
            setError(null);
            await mutation.mutateAsync(input);
          }}
          submitLabel="Сохранить"
          pending={mutation.isPending}
          submitError={error}
        />
      )}
    </div>
  );
}
