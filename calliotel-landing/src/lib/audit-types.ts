export type TrafficEstimate = {
  level: "Low" | "Medium" | "High";
  reason: string;
};

export type SeoHealth = {
  score: number;
  issues: string[];
  quick_wins: string[];
};

export type WebsiteAuditResult = {
  website_url: string;
  overall_score: number;
  traffic_estimate: TrafficEstimate;
  seo_health: SeoHealth;
  competitor_insights: string[];
  ai_ad_recommendations: string[];
  missing_keywords: string[];
  ssl_status: string;
  response_time_ms?: number | null;
  title?: string | null;
  /** @deprecated use overall_score */
  site_score: number;
  /** @deprecated use ai_ad_recommendations */
  ad_recommendations: string[];
  competitor_insight?: string | null;
};