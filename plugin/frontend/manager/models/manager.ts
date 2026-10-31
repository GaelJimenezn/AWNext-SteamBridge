export type ManagerTab = 'games' | 'sources' | 'appearance';

export interface ManagerTabDefinition {
  readonly id: ManagerTab;
  readonly label: string;
}
