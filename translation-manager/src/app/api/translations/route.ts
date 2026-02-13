import { NextRequest } from 'next/server';
import {
  handleGetTranslationsList,
  handleCreateTranslation,
} from './handlers';

/**
 * GET /api/translations
 * List translations with filtering and pagination
 */
export async function GET(request: NextRequest) {
  return handleGetTranslationsList(request);
}

/**
 * POST /api/translations
 * Create a new translation
 */
export async function POST(request: NextRequest) {
  return handleCreateTranslation(request);
}
