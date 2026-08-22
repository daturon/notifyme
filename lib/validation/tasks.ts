import { z } from "zod";
import { weatherRulesSchema } from "../triggers/weatherTask/taskRules";

export const createTaskSchema = z.object({
  eventId: z.string().uuid(),
  title: z.string().trim().min(1, "title is required"),
  intervalDays: z.number().int().positive(),
  weatherRules: weatherRulesSchema,
});

export const updateTaskSchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    intervalDays: z.number().int().positive().optional(),
    weatherRules: weatherRulesSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
