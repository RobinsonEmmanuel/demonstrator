export type SocialPlatform = 'facebook' | 'linkedin' | 'instagram' | 'twitter';

export type SocialAccount = {
  poiId: string;
  poiName: string;
  platform: SocialPlatform;
  url: string;
};

export type SocialPost = {
  id: string;
  postUrl: string;
  pageUrl: string;
  poiId?: string;
  poiName?: string;
  text: string;
  publishedAt: string;
  likes?: number;
  comments?: number;
  shares?: number;
};

export type SocialPostReaction = 'like' | 'comment';

export type SocialPostPick = {
  postId: string;
  reaction: SocialPostReaction;
  justification: string;
  suggestedComment?: string;
};

export type SocialWatchFilterMode = 'demo' | 'custom' | 'all';

export type SocialAccountsResponse = {
  clusterId: string;
  accounts: SocialAccount[];
  facebookCount: number;
  filterMode: SocialWatchFilterMode;
  /** POI retenus quand un filtre est actif */
  poiFilter?: string[];
};

export type SocialScrapeResponse = {
  posts: SocialPost[];
  scrapedAt: string;
  facebookPagesScraped: number;
};

export type SitDbUpdateSuggestion = {
  poiId: string;
  poiName: string;
  postId: string;
  blockId: string;
  sectionId: string;
  fieldId: string;
  currentValue: string;
  suggestedValue: string;
  justification: string;
};

export type SocialAnalyzeResponse = {
  picks: SocialPostPick[];
  dbUpdates: SitDbUpdateSuggestion[];
  postsById: Record<string, SocialPost>;
};
