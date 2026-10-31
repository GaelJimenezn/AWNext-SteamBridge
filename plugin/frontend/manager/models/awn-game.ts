export interface AwnGame {
  name: string;
  awnId: string;
  source: string;
  installed: boolean | null;
  steamOfficial: boolean | null;
  total: number;
  unlocked: number;
  hasCatalog: boolean;
}

export interface AwnLibraryResponse {
  ok: boolean;
  count?: number;
  error?: string;
  games: AwnGame[];
}