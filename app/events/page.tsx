"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { EventCard } from "@/components/EventCard";
import { listEvents } from "@/lib/api/events";

export default function EventsPage() {
  const eventsQuery = useQuery({ queryKey: ["events"], queryFn: listEvents });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">События</h1>
        <Link
          href="/events/new"
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-black dark:hover:bg-zinc-300"
        >
          + Новое
        </Link>
      </div>

      {eventsQuery.isLoading && <p className="text-sm text-zinc-500">Загрузка…</p>}

      {eventsQuery.isError && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          Не удалось загрузить события
        </p>
      )}

      {eventsQuery.data && eventsQuery.data.events.length === 0 && (
        <p className="text-sm text-zinc-500">Событий пока нет. Создайте первое.</p>
      )}

      <div className="flex flex-col gap-3">
        {eventsQuery.data?.events.map((event) => <EventCard key={event.id} event={event} />)}
      </div>
    </div>
  );
}
