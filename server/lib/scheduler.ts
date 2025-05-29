import { storage } from "../storage";
import { bbecClient } from "./soap-client";

interface ScheduledTask {
  id: string;
  interval: NodeJS.Timeout;
  lastRun?: Date;
  nextRun?: Date;
}

class AffinityTagScheduler {
  private tasks: Map<string, ScheduledTask> = new Map();
  private isInitialized = false;

  async initialize() {
    if (this.isInitialized) return;
    
    try {
      const settings = await storage.getAffinityTagSettings();
      if (settings?.autoRefresh) {
        await this.scheduleRefresh(settings.refreshInterval as 'hourly' | 'daily' | 'weekly');
      }
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize affinity tag scheduler:', error);
    }
  }

  async scheduleRefresh(interval: 'hourly' | 'daily' | 'weekly') {
    // Clear existing task
    this.clearRefreshTask();

    const intervalMs = this.getIntervalMs(interval);
    const taskId = 'affinity-refresh';

    const task: ScheduledTask = {
      id: taskId,
      interval: setInterval(async () => {
        await this.performRefresh();
      }, intervalMs),
      nextRun: new Date(Date.now() + intervalMs)
    };

    this.tasks.set(taskId, task);
    console.log(`Scheduled affinity tag refresh every ${interval} (${intervalMs}ms)`);
  }

  clearRefreshTask() {
    const taskId = 'affinity-refresh';
    const existingTask = this.tasks.get(taskId);
    if (existingTask) {
      clearInterval(existingTask.interval);
      this.tasks.delete(taskId);
      console.log('Cleared existing affinity tag refresh schedule');
    }
  }

  private getIntervalMs(interval: 'hourly' | 'daily' | 'weekly'): number {
    switch (interval) {
      case 'hourly':
        return 60 * 60 * 1000; // 1 hour
      case 'daily':
        return 24 * 60 * 60 * 1000; // 1 day
      case 'weekly':
        return 7 * 24 * 60 * 60 * 1000; // 1 week
      default:
        return 24 * 60 * 60 * 1000; // Default to daily
    }
  }

  private async performRefresh() {
    try {
      console.log('Starting scheduled affinity tag refresh...');
      
      const bbecTags = await bbecClient.getAffinityTags();
      
      const tagsToInsert = bbecTags.map(tag => ({
        name: tag.name,
        category: tag.category,
        bbecId: tag.id
      }));

      await storage.updateAffinityTags(tagsToInsert);
      
      // Update settings with last refresh time
      const currentSettings = await storage.getAffinityTagSettings();
      if (currentSettings) {
        await storage.updateAffinityTagSettings({
          ...currentSettings,
          lastRefresh: new Date(),
          totalTags: tagsToInsert.length
        });
      }

      console.log(`Scheduled refresh completed: ${tagsToInsert.length} affinity tags updated`);
    } catch (error) {
      console.error('Scheduled affinity tag refresh failed:', error);
    }
  }

  async updateSchedule(autoRefresh: boolean, interval: 'hourly' | 'daily' | 'weekly') {
    if (autoRefresh) {
      await this.scheduleRefresh(interval);
    } else {
      this.clearRefreshTask();
    }
  }

  getScheduleStatus() {
    const taskId = 'affinity-refresh';
    const task = this.tasks.get(taskId);
    
    return {
      isScheduled: !!task,
      nextRun: task?.nextRun,
      lastRun: task?.lastRun
    };
  }

  shutdown() {
    Array.from(this.tasks.values()).forEach(task => {
      clearInterval(task.interval);
    });
    this.tasks.clear();
    console.log('Affinity tag scheduler shutdown complete');
  }
}

export const affinityTagScheduler = new AffinityTagScheduler();

// Initialize scheduler when module is loaded
affinityTagScheduler.initialize().catch(console.error);