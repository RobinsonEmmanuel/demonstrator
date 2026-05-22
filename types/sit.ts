/** Option POI pour l'autocomplétion SIT (place-instance-drafts). */
export interface SitPoiOption {
  id: string;
  label: string;
  subtitle?: string;
}

export interface SitClusterDraftsResponse {
  clusterId: string;
  items: SitPoiOption[];
}
