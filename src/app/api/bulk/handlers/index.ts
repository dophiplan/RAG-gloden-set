import type { HandlerRegistry } from '../types';

// Translation handlers
import { translationsCreate } from './translations/create';
import { translationsUpdate } from './translations/update';
import { translationsDelete } from './translations/delete';
import { translationsRevert } from './translations/revert';
import { translationsProducts } from './translations/products';
import { translationsLogs } from './translations/logs';
import { translationsStatus } from './translations/status';

// Glossary handlers
import { glossaryCreate } from './glossary/create';
import { glossaryUpdate } from './glossary/update';
import { glossaryDelete } from './glossary/delete';
import { glossaryRevert } from './glossary/revert';

// Users handlers
import { usersUpload } from './users/upload';

// Admin Users handlers
import { adminUsersDelete } from './admin-users/delete';
import { adminUsersUpdate } from './admin-users/update';

export const handlerRegistry: HandlerRegistry = {
  // Translations
  'translations:create': translationsCreate,
  'translations:update': translationsUpdate,
  'translations:delete': translationsDelete,
  'translations:revert': translationsRevert,
  'translations:products': translationsProducts,
  'translations:logs': translationsLogs,
  'translations:status': translationsStatus,

  // Glossary
  'glossary:create': glossaryCreate,
  'glossary:update': glossaryUpdate,
  'glossary:delete': glossaryDelete,
  'glossary:revert': glossaryRevert,

  // Users
  'users:upload': usersUpload,

  // Admin Users
  'admin-users:delete': adminUsersDelete,
  'admin-users:update': adminUsersUpdate,
};
