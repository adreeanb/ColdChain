ALTER TABLE "cold_unit_devices"
  ADD COLUMN "api_key_hash" TEXT,
  ADD COLUMN "last_seen_at" TIMESTAMP(3);

-- Último contato a partir dos dados já recebidos. A quarentena não guarda a hora de chegada:
-- vale o horário da leitura, como antes.
UPDATE "cold_unit_devices" d
SET "last_seen_at" = s."last_seen_at"
FROM (
  SELECT "device_id", max("seen") AS "last_seen_at"
  FROM (
    SELECT "device_id", max("created_at") AS "seen" FROM "temperature_readings" GROUP BY "device_id"
    UNION ALL
    SELECT "device_id", max("timestamp") AS "seen" FROM "unbound_telemetry" GROUP BY "device_id"
  ) AS "contacts"
  GROUP BY "device_id"
) AS s
WHERE s."device_id" = d."id";
