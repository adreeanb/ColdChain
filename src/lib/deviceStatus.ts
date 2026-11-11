const DEFAULT_OFFLINE_MINUTES = 10;

export function getOfflineThresholdMinutes() {
  const minutes = Number(process.env.SENSOR_OFFLINE_MINUTES);
  return minutes > 0 ? minutes : DEFAULT_OFFLINE_MINUTES;
}

export function isRecent(date: Date | null, now = new Date()) {
  if (!date) {
    return false;
  }

  return now.getTime() - date.getTime() <= getOfflineThresholdMinutes() * 60 * 1000;
}

