// Import the telegram scheduler serviceimport { telegramSchedulerService } from "./services/telegram/telegram-scheduler.service";

// In the initializeServices function or a relevant startup function, add:
telegramSchedulerService.start();
