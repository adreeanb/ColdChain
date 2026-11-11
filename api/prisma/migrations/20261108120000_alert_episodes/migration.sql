-- Leituras repetidas (reenvio do store-and-forward): fica a primeira que chegou
DELETE FROM "temperature_readings" a
USING "temperature_readings" b
WHERE a."device_id" = b."device_id"
  AND a."timestamp" = b."timestamp"
  AND (a."created_at", a."id") > (b."created_at", b."id");

DELETE FROM "unbound_telemetry" a
USING "unbound_telemetry" b
WHERE a."device_id" = b."device_id"
  AND a."timestamp" = b."timestamp"
  AND (a."expires_at", a."id") > (b."expires_at", b."id");

-- O índice único começa por device_id e substitui o índice simples
DROP INDEX "temperature_readings_device_id_idx";
CREATE UNIQUE INDEX "temperature_readings_device_id_timestamp_key" ON "temperature_readings"("device_id", "timestamp");

DROP INDEX "unbound_telemetry_device_id_idx";
CREATE UNIQUE INDEX "unbound_telemetry_device_id_timestamp_key" ON "unbound_telemetry"("device_id", "timestamp");

-- Alertas viram episódios. Os antigos eram de uma leitura só e ficam encerrados nela.
ALTER TABLE "alerts"
  ADD COLUMN "device_id" TEXT,
  ADD COLUMN "peak_temperature" DOUBLE PRECISION,
  ADD COLUMN "readings_count" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "started_at" TIMESTAMP(3),
  ADD COLUMN "last_reading_at" TIMESTAMP(3),
  ADD COLUMN "ended_at" TIMESTAMP(3);

UPDATE "alerts"
SET "peak_temperature" = "temperature",
    "started_at" = "created_at",
    "last_reading_at" = "created_at",
    "ended_at" = "created_at";

ALTER TABLE "alerts"
  ALTER COLUMN "peak_temperature" SET NOT NULL,
  ALTER COLUMN "started_at" SET NOT NULL,
  ALTER COLUMN "last_reading_at" SET NOT NULL;

ALTER TABLE "alerts" ADD CONSTRAINT "alerts_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "cold_unit_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "alerts_cold_unit_id_device_id_started_at_idx" ON "alerts"("cold_unit_id", "device_id", "started_at");
