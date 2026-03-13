# Migration Flow Analysis & Fix Summary

## Issue Description
The migration flow hangs or fails when user clicks "마이그레이션 실행" (Commit Migration).

## Root Cause Analysis

### The Actual Error (from server logs)
```
Error: insert or update on table "translation_products" 
violates foreign key constraint "translation_products_product_code_fkey"
```

This error occurs at `commit/route.ts:513` when trying to insert into `translation_products` table.

### Data Flow Trace

```
1. User uploads file
   ↓
2. User selects product from dropdown (UploadStep.tsx)
   - Uses product.code from useProducts() hook
   ↓
3. User clicks Preview
   - loadPreview() calls /api/migration/preview
   - Sends product_code as FormData
   ↓
4. User clicks "마이그레이션 실행"
   - commitMigration() calls /api/migration/commit
   - Sends product_code in JSON body
   ↓
5. Server validates product_code exists (lines 167-186)
   ↓
6. Server tries to INSERT into translation_products (line 540)
   ↓
   ❌ FK CONSTRAINT VIOLATION - product_code doesn't exist in products table
```

### Why This Happens

1. **The product_code being sent doesn't exist in the database's `products` table**
   - The UI shows products from `useProducts()` hook
   - But these products might not be synchronized with the actual DB
   - Or the products table might be empty

2. **Validation gap:**
   - First request returned 400 (validation caught it)
   - Second request passed validation but failed at INSERT
   - This suggests a race condition or data inconsistency

## Files Modified

### 1. `/src/app/api/migration/commit/route.ts`

**Changes made:**
- Added input normalization (trim whitespace, ensure string type)
- Added debug logging for product_code validation
- Added listing of available products when validation fails
- Added better error handling for translation_products INSERT

**Key additions:**
```typescript
// Normalize product_code
const normalizedProductCode = typeof product_code === 'string' ? product_code.trim() : String(product_code);

// Debug logging
console.log('[Migration] Validating product_code:', product_code, 'type:', typeof product_code);

// List available products on validation failure
const { data: availableProducts } = await adminClient
  .from('products')
  .select('code, name')
  .limit(10);
```

### 2. `/src/app/(dashboard)/settings/migration/contexts/MigrationContext.tsx`

**Changes made:**
- Added debug logging for commit request
- Logs product_code, entries_count, and version before sending

```typescript
console.log('[commitMigration] Sending request:', {
  product_code: requestBody.product_code,
  entries_count: requestBody.entries.length,
  version: requestBody.version,
});
```

## Test Steps to Verify Fix

### Step 1: Check Products in Database
```sql
SELECT code, name FROM products LIMIT 10;
```

If no products exist, insert test data:
```sql
INSERT INTO products (code, name, description) VALUES 
  ('RC', 'RC Product', 'Test product'),
  ('RV', 'RV Product', 'Test product'),
  ('RM', 'RM Product', 'Test product');
```

### Step 2: Test the Migration Flow

1. Open browser DevTools → Console
2. Navigate to Settings → Migration
3. Upload an Excel file with columns:
   - source_text (원문)
   - ko (한국어 번역)
   - product_category (제품분류)
4. Select a product from dropdown
5. Map fields (source → source_text, translations → ko, metadata → product_category)
6. Click Preview
7. Click "마이그레이션 실행"

### Step 3: Check Console Logs

**Expected client logs:**
```
[commitMigration] Sending request: {
  product_code: "RC",
  entries_count: 5,
  version: null
}
```

**Expected server logs:**
```
[Migration] Validating product_code: RC type: string
[Migration] Starting processing: 5 entries
[Migration] Glossary: 2, Translations: 3
...
[Migration] Completed processing 5 entries in XXXms
```

### Step 4: If Error Occurs

Check the response in Network tab:
- If 400 with "제품 코드가 존재하지 않습니다":
  - The product_code doesn't exist in DB
  - Check console for "Available products:" list
  - Add the missing product to products table

- If 500 with FK constraint error:
  - Check that the product_code in the request matches exactly (case-sensitive)
  - Check that products table has the code

## Additional Checks

### Database Schema Verification

Ensure the products table exists:
```sql
\dt products
```

Ensure translation_products FK is correct:
```sql
\d translation_products
```

Should show:
```
product_code | text | not null | fk | translation_products_product_code_fkey
```

### Product Code Consistency

Check if product codes match between what UI sends and what DB expects:
```sql
SELECT code FROM products WHERE code IN ('RC', 'RV', 'RM', 'rfice', 'repoto', 'RVS', '모비즌', '에이전트', '마케팅');
```

## Prevention Measures

1. **Add product synchronization check** on app startup
2. **Add product validation** in the UI before allowing commit
3. **Add transaction wrapper** around the entire migration (currently using manual rollback)
4. **Add product_code dropdown validation** - only show products that exist in DB

## Summary

The migration "hang" was actually a server error (500) that wasn't being handled properly in the UI. The root cause was a **data inconsistency** between the products shown in the UI dropdown and the products actually stored in the database.

The fix adds:
1. Better error messages showing available products
2. Input normalization to prevent whitespace issues
3. Debug logging to trace the exact values being sent/received

**To completely fix:** Ensure the `products` table is populated with the product codes that the UI expects.
