KAP Core hared Library for GAS Project
- Technical Reference
// Identifier: KAP (recommended)
const { Cache, Fmt, Validate, Sheets, Ids, Resp, Html } = KAP.Core;
Module Reference | kapCoreCache.gs | Cache 
/**
 * Get or compute cached value
 * @param {string} namespace - Logical grouping
 * @param {string} key - Unique key within namespace
 * @param {number} ttlSeconds - Time-to-live (60-21600)
 * @param {Function} computeFn - Returns value if not cached
 * @returns {any} Cached or computed value
 */
KAP.Core.Cache.getOrCompute(namespace, key, ttlSeconds, computeFn);
// Example: Cache API response for 5 minutes
const data = KAP.Core.Cache.getOrCompute(
  'WeatherAPI',
  'mumbai_current',
  300,
  () => UrlFetchApp.fetch('https://api.weather.com/mumbai').getContentText()
);
Module Reference | kapCoreFmt.gs | Formatting 
// Currency
KAP.Core.Fmt.formatINR(1234567.89);      // "? 12,34,567.89"
KAP.Core.Fmt.formatINRShort(1500000);    // "? 15.0L"
// Dates (uses script timezone)
KAP.Core.Fmt.formatIsoDate(new Date());  // "2025-12-10"
KAP.Core.Fmt.formatDateOnly(date, 'DD-MON-YYYY');  // "10-DEC-2025"
// Text
KAP.Core.Fmt.normalizeName('rajesh kumar');     // "Rajesh Kumar"
KAP.Core.Fmt.normalizeName('"iPhone 12 Pro"');  // "iPhone 12 Pro" (exact case)
// Month parsing
KAP.Core.Fmt.monthLabelToKey('Oct-2025');  // 202510 (for sorting)
Module Reference | kapCoreValidate.gs | Validation 
/**
 * Validates Indian PAN/GSTIN
 * Returns: { valid: boolean, message?: string, value?: string }
 * Empty input returns { valid: true }
 */
const panResult = KAP.Core.Validate.pan('AAAAA1234A');
const gstResult = KAP.Core.Validate.gst('22AAAAA0000A1Z5');
// Check: panResult.valid, panResult.value (uppercase normalized)
Module Reference | kapCoreSheets.gs | Sheets 
// Cached spreadsheet access
const ss = KAP.Core.Sheets.openByIdCached('SPREADSHEET_ID');
// Get sheet (throws if not found)
const sheet = KAP.Core.Sheets.getSheet(ss, 'SheetName');
// Read as objects (with reserved column support)
const data = KAP.Core.Sheets.getTableObjects(sheet, {
  headerRowIndex: 1,
  dataStartRow: 2,
  reserveConfigCell: 'Z1'  // Optional: {"Reserve1": "ActualColumn"}
});
// Upsert (update if exists, insert if new)
const rowNum = KAP.Core.Sheets.upsertRowByKey(
  sheet,
  'EmployeeID',    // Key column
  'EMP-001',       // Key value
  { Name: 'Raj', Salary: 50000 },  // Data
  1                // Header row index
);
Module Reference | kapCoreIds.gs | IDs 
/**
 * Generates sortable timestamp-based IDs
 * Format: {prefix}-{YYYYMMDD}-{random3Digits}
 * 900 unique IDs/day/prefix
 */
KAP.Core.Ids.generate('INV');  // "INV-20251210-427"
KAP.Core.Ids.generate('CUST'); // "CUST-20251210-815"
Module Reference | kapCoreResp.gs | Response
// Success response
KAP.Core.Resp.ok(data);  // { ok: true, data: data, error: null }
// Error response
KAP.Core.Resp.fail('Error message', { details: 'context' });
// Returns: { ok: false, data: null, error: {message, details} }
// Usage pattern
function process() {
  try {
    const result = doWork();
    return KAP.Core.Resp.ok(result);
  } catch (error) {
    return KAP.Core.Resp.fail('Processing failed', {
      error: error.message,
      stack: error.stack
    });
  }
}
Module Reference | kapCoreHtml.gs | HTML/UI
// Inject into templates
html.kapCoreCss = KAP.Core.Html.getCoreCss();
html.kapHeaderFooter = KAP.Core.Html.getHeaderFooter({
  appSubtitle: 'Dashboard',
  footerMeta: 'v1.0 • Production'
});
html.kapLoader = KAP.Core.Html.getGlobalLoader();
html.kapClientJS = KAP.Core.Html.getClientJS();

#### 1. Complete Data Flow #####
function processInvoice(data) {
  // Validate
  const panResult = KAP.Core.Validate.pan(data.pan);
  if (!panResult.valid) {
    return KAP.Core.Resp.fail('Invalid PAN', panResult);
  }
  
  // Format
  const formatted = {
    amount: KAP.Core.Fmt.formatINR(data.amount),
    date: KAP.Core.Fmt.formatIsoDate(new Date(data.date))
  };
  
  // Generate ID
  const invoiceId = KAP.Core.Ids.generate('INV');
  
  // Cache expensive operations
  const cachedData = KAP.Core.Cache.getOrCompute(
    'Invoices',
    invoiceId,
    300,
    () => saveToDatabase({ id: invoiceId, ...data })
  );
  
  // Return standardized response
  return KAP.Core.Resp.ok({
    id: invoiceId,
    data: cachedData,
    formatted: formatted
  });
}
#### 2. Sheet Operations with Reserved Columns #####
// Setup: In Row 2, store JSON: {"Reserve1": "ActualField", "Reserve2": "AnotherField"}
// Sheet headers: Name, Amount, Reserve1, Reserve2
// Code sees: Name, Amount, ActualField, AnotherField
const data = KAP.Core.Sheets.getTableObjects(sheet, {
  headerRowIndex: 1,
  dataStartRow: 2,
  reserveConfigCell: 'Z1' <<< Example, Not Always  Z1
});
// Schema changes without modifying headers: just update Z1 
#### 3. UI Integration  ####
// Server-side (.gs)
function doGet() {
  const html = HtmlService.createTemplateFromFile('App');
  
  // Inject all KAP UI components
  html.kapCoreCss = KAP.Core.Html.getCoreCss();
  html.kapHeaderFooter = KAP.Core.Html.getHeaderFooter({/* config */});
  html.kapLoader = KAP.Core.Html.getGlobalLoader();
  html.kapClientJS = KAP.Core.Html.getClientJS();
  
  return html.evaluate();
}
// Client-side (in template)
// KAP.loader.show() / .hide() available
// KAP.notify.success() / .error() available
#### Performance & Limits ####
// Cache limits:
// - 10MB total cache
// - 100KB per key
// - Max TTL: 21600 seconds (6 hours)
// Sheets performance:
// - Use batch operations (getValues/setValues)
// - Avoid getValue/setValue in loops
// - Cache sheet data when possible
// Quotas: All calls count toward GAS daily quotas
Error Handling Contract
// ALL KAP Core functions:
// - Throw on invalid parameters
// - Return standardized objects (Validate, Sheets.getTableObjects)
// - Never throw for business logic failures (use Resp.fail())
// Client must always:
// 1. Check response.ok first
// 2. Handle KAP.Core.Resp.fail() responses
// 3. Wrap in try-catch for unexpected errors
#### Gotchas ####
Sheet names are case-sensitive in getSheet()
PAN validation requires exact format (10 chars, first 5 letters, etc.)
Cache is shared across all users (script cache)
Empty inputs return valid in Validate module (for optional fields)
All date formatting uses script timezone, not user timezone
900 IDs/day/prefix maximum - plan accordingly for high-volume systems
####  Module Dependencies ####
Cache ? (none)
Fmt ? Session, Utilities
Validate ? (none)
Sheets ? SpreadsheetApp, Cache (for openByIdCached)
Ids ? Session, Utilities
Resp ? (none)
Html ? HtmlService
#### When to Use What ####
Use Case	Primary Module	Secondary
Reduce API calls	Cache	-
Indian currency display	Fmt	-
Tax ID validation	Validate	Resp
Sheet data as objects	Sheets	Cache
Unique record IDs	Ids	-
API response format	Resp	-
Consistent UI	Html	Fmt
Batch processing	Sheets, Cache	-
#### The 1-Page Cheat Sheet ####
// 1. Import & Setup
// Library ID: [YOUR_ID] | Alias: KAP | Version: latest
// 2. Use in code:
const { Cache, Fmt, Validate, Sheets, Ids, Resp, Html } = KAP.Core;
// 3. Key patterns:
// - Always check `response.ok` first
// - Use Cache for expensive ops
// - Format INR with Fmt.formatINR()
// - Generate IDs with Ids.generate(prefix)
// - Validate PAN/GST with Validate.pan()/.gst()
// - Read sheets as objects with Sheets.getTableObjects()
Module Reference | kapClientJS.html | KAP Client API 
API Reference : KAP.API.call(funcName, params)
Promise-based wrapper for google.script.run with standardized response handling.
// Signature
KAP.API.call(funcName: string, params: any): Promise<any>
Returns: Promise that:
Resolves with response.data (if response.ok === true)
Rejects with error message (if response.ok === false or transport error)
// Server MUST return KAP.Core.Resp format
{
  ok: true,           // boolean
  data: any,          // success payload
  error: null         // null on success
}
// OR
{
  ok: false,
  data: null,
  error: { message: string, details: any }
}

API Reference :  KAP.API.toggleLoader(show, text)
Controls the global loading overlay.
// Signature
KAP.API.toggleLoader(show: boolean, text?: string): void
HTML Structure Required:
<!-- Must exist in your HTML -->
<div id="global-loader-overlay" class="kap-loader-overlay">
  <div class="kap-spinner"></div>
  <div class="loader-text">Loading...</div>
</div>
Example Usage:
// Show with custom text
KAP.API.toggleLoader(true, 'Processing data...');
// Hide when done
KAP.API.toggleLoader(false);
Client-Server Flow
Client (Browser)
    ? KAP.API.call('getUser', {id: 123})
    ? Promise created
    ? google.script.run.withSuccessHandler()
Server (GAS)
    ? getUser({id: 123}) executes
    ? Returns KAP.Core.Resp.ok(data) or .fail(error)
    ? Response sent to client
Client
    ? Success/Error handler executes
    ? Promise resolves/rejects
    ? Your .then()/.catch() runs