/**
 * File Name   : Code.gs
 * PROJECT     : KNIPL LogBook
 * DESCRIPTION : Lean Entry Point for the Web App.
 * Uses KAP.API.call from the client to route to kapLBService.gs
 */

/**
 * Standard GAS function to serve the Web App
 */
function doGet(e) {
  const functionName = 'doGet';
  // CRITICAL FIX: Added null-safe parameter access
  logAction(functionName, 'App Launch Initiated', e ? e.parameter : {});
  
  try {
    const template = HtmlService.createTemplateFromFile('index');
    
    // Evaluate the template and set mobile-friendly meta tags
    return template.evaluate()
      .setTitle(KNIPL_CONFIG.UI_SETTINGS.APP_TITLE)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
      
  } catch (error) {
    logAction(functionName, 'CRITICAL FAILURE', error.message);
    // CRITICAL FIX: Mobile-responsive error page
    return HtmlService.createHtmlOutput(
      "<!DOCTYPE html><html><head>" +
      "<meta name='viewport' content='width=device-width, initial-scale=1'>" +
      "<style>body{font-family:sans-serif;padding:20px;color:#333;}</style>" +
      "</head><body>" +
      "<h2>Application Temporarily Unavailable</h2>" +
      "<p>We apologize for the inconvenience. Please try again later.</p>" +
      "<small>Error reference: " + new Date().getTime() + "</small>" +
      "</body></html>"
    );
  }
}

/**
 * Global helper for Including HTML/JS files into index.html
 * Used in index.html like: <?!= include('mainJS'); ?>
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}