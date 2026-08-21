import "dotenv/config";
import { db } from "../db";
import { events, householdTasks } from "./schema";

async function main() {
  const [exchangeRateEvent] = await db
    .insert(events)
    .values({
      name: "Курс RUB → BYN в Жлобине",
      type: "exchange_rate",
      config: {
        city: "Жлобин",
        fromCurrency: "RUB",
        toCurrency: "BYN",
        minRatePer100: 3.2,
      },
      recipientEmail: "daturon@gmail.com",
    })
    .returning();

  const [weatherTaskEvent] = await db
    .insert(events)
    .values({
      name: "Погодные рекомендации по хозяйству",
      type: "weather_task",
      config: {
        location: { lat: 52.888, lon: 30.041 },
      },
      recipientEmail: "daturon@gmail.com",
    })
    .returning();

  await db.insert(householdTasks).values({
    eventId: weatherTaskEvent.id,
    title: "Покос травы",
    intervalDays: 14,
    weatherRules: {
      minDryDaysInRow: 2,
      minTempC: 12,
      maxTempC: 28,
    },
  });

  console.log("Seeded events:", {
    exchangeRateEvent: exchangeRateEvent.id,
    weatherTaskEvent: weatherTaskEvent.id,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
