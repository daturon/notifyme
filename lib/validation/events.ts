import { z } from "zod";
import { listProviderTypes } from "../triggers/registry";

// Тип события проверяется по факту регистрации в реестре триггеров, а не по
// фиксированному списку — так добавление нового провайдера не требует правки
// валидации.
const eventTypeSchema = z.string().refine((type) => listProviderTypes().includes(type), {
  message: "Unknown event type",
});

export const createEventSchema = z.object({
  name: z.string().trim().min(1, "name is required"),
  type: eventTypeSchema,
  config: z.unknown(),
  isActive: z.boolean().optional(),
  recipientEmail: z.string().email("recipientEmail must be a valid email"),
});

export const updateEventSchema = createEventSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;

export const historyQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});
