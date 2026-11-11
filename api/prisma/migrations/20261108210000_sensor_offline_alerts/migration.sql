CREATE TYPE "AlertType" AS ENUM ('OUT_OF_RANGE', 'SENSOR_OFFLINE');

-- Alertas de placa sem sinal não têm temperatura
ALTER TABLE "alerts"
  ADD COLUMN "type" "AlertType" NOT NULL DEFAULT 'OUT_OF_RANGE',
  ALTER COLUMN "temperature" DROP NOT NULL,
  ALTER COLUMN "peak_temperature" DROP NOT NULL;
