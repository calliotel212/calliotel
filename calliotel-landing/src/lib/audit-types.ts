export type WebsiteAuditResult = {
  website_url: string;
  site_score: number;
  ssl_status: string;
  missing_keywords: string[];
  competitor_insights: string;
  ad_recommendations: string[];
  response_time_ms?: number | null;
  title?: string | null;
};