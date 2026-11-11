import { DetectOfflineDevicesService } from '../services/alert/DetectOfflineDevicesService.js';

const DETECT_INTERVAL_MS = 60 * 1000; // 1 minuto

export function iniciarDetectOfflineDevicesJob() {
  const detectOfflineDevicesService = new DetectOfflineDevicesService();

  const run = async () => {
    try {
      await detectOfflineDevicesService.execute();
    } catch (error: any) {
      console.error('❌ Erro ao verificar placas sem sinal:', error.message);
    }
  };

  run();
  setInterval(run, DETECT_INTERVAL_MS);
}
