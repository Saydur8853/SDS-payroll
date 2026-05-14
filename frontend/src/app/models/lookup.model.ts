export interface LookupItem {
  id: string;
  name: string;
  dynamicAttributes?: Record<string, string | null>;
}
