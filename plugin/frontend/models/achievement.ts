export type Achievement = {
  id: string;
  name: string;
  description: string;
  icon?: string;
  unlocked: boolean;
  unlockTime: number;
};

export type AchievementResult = {
  title?: string;
  source?: string;
  total?: number;
  unlocked?: number;
  achievements?: Achievement[];
  error?: string;
  notConfigured?: boolean;
  stage?: string;
  configPath?: string;
  statePath?: string;
  schemaPath?: string;
};
