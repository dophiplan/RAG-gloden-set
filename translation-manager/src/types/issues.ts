import type { ProductCode } from './products';

// Issue types
export type IssueType = 'pdf_parse_error' | 'image_parse_error' | 'duplicate_text' | 'validation_error';

export interface Issue {
  id: string;
  product_code: ProductCode | null;
  issue_type: IssueType;
  description: string;
  file_names: string[];
  resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
}
