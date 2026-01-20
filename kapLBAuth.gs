/**
 * File Name   : kapLBAuth.gs
 * PROJECT     : KNIPL LogBook
 * MODULE      : Authentication & Master Gateway
 */

// Constants for column indices (for maintainability)
const USER_COLUMNS = {
  ID: 0,
  FIRST_NAME: 1,
  LAST_NAME: 2,
  KNOWN_AS: 3,
  ROLE: 4,
  MODULE_ID: 5,
  EMAIL: 6
};

/**
 * THE MASTER GATEWAY
 * Performs Strict Manual Auth and then Hydrates the App.
 */
function getInitialAppDataWithAuth(manualEmail = null) {
  const functionName = 'getInitialAppDataWithAuth';
  logAction(`[kapLBAuth][${functionName}]`, 'Auth initiated');
  const email = (manualEmail || "").toLowerCase().trim();
  
  if (!email) {
    return { 
      ok: false, 
      data: { needsLogin: true }, 
      error: { message: "Email not provided" } 
    };
  }

  try {
    // CRITICAL FIX: Validate configuration
    if (!KNIPL_CONFIG || !KNIPL_CONFIG.DATABASE || !KNIPL_CONFIG.DATABASE.INPUT_STORE) {
      throw new Error("Database configuration missing");
    }
    
    // 1. Auth Lookup
    const ss = SpreadsheetApp.openById(KNIPL_CONFIG.DATABASE.INPUT_STORE);
    const loggerSheet = ss.getSheetByName(KNIPL_CONFIG.TABS.LOGGERS);
    
    // CRITICAL FIX: Check if sheet exists
    if (!loggerSheet) {
      throw new Error(`Sheet '${KNIPL_CONFIG.TABS.LOGGERS}' not found`);
    }
    
    const loggerData = loggerSheet.getDataRange().getValues();
    
    const userRows = loggerData.filter(row => {
      const rowEmail = row[USER_COLUMNS.EMAIL] ? 
        row[USER_COLUMNS.EMAIL].toString().toLowerCase().trim() : "";
      return rowEmail === email;
    });

    if (userRows.length === 0) {
      return { 
        ok: false, 
        data: { needsLogin: true }, 
        error: { message: `Email [${email}] not registered.` } 
      };
    }

    // 2. Construct verified User Context
    const userContext = {
      personId: userRows[0][USER_COLUMNS.ID],
      fullName: `${userRows[0][USER_COLUMNS.FIRST_NAME]} ${userRows[0][USER_COLUMNS.LAST_NAME]}`,
      knownAs: userRows[0][USER_COLUMNS.KNOWN_AS],
      role: userRows[0][USER_COLUMNS.ROLE],
      email: email,
      allowedModuleIds: [...new Set(userRows.map(row => row[USER_COLUMNS.MODULE_ID]))]
    };

    // 3. Hydrate Data
    const fullResponse = getInitialAppData(userContext);

    // 4. PACKAGE FOR KAP CORE
    if (fullResponse.ok && fullResponse.data) {
      return {
        ok: true,
        data: {
          ...fullResponse.data,
          needsLogin: false
        },
        error: null
      };
    } else {
      // CRITICAL FIX: Safe error message extraction
      let errorMessage = "Data Hydration Failed";
      if (fullResponse.error) {
        if (typeof fullResponse.error === 'object' && fullResponse.error.message) {
          errorMessage = fullResponse.error.message;
        } else {
          errorMessage = String(fullResponse.error);
        }
      }
      
      return { 
        ok: false, 
        data: { needsLogin: true }, 
        error: { message: errorMessage } 
      };
    }
    
  } catch (error) {
    logAction(`[kapLBAuth][${functionName}]`, 'Auth Error', error.message);
    return { 
      ok: false, 
      data: { needsLogin: true }, 
      error: { message: "Authentication service unavailable. Please try again later." } 
    };
  }
}

/**
 * Helper: Fetches metadata for the modules assigned to the user.
 * Must be present in this file for getInitialAppData to call it.
 */
function getAssignedModuleMetadata(moduleIds) {
  const functionName = 'getAssignedModuleMetadata';
  
  // CRITICAL FIX: Validate input
  if (!moduleIds || !Array.isArray(moduleIds) || moduleIds.length === 0) {
    return [];
  }
  
  try {
    const ss = SpreadsheetApp.openById(KNIPL_CONFIG.DATABASE.INPUT_STORE);
    const moduleSheet = ss.getSheetByName(KNIPL_CONFIG.TABS.MODULES);
    
    if (!moduleSheet) {
      logAction(`[kapLBAuth][${functionName}]`, 'Warning', 'Modules sheet not found');
      return [];
    }
    
    const data = moduleSheet.getDataRange().getValues();
    const headers = data.shift();
    const filteredModules = data.filter(row => moduleIds.includes(row[0]))
      .map(row => {
        let obj = {};
        headers.forEach((header, i) => obj[header] = row[i]);
        return obj;
      });

    return filteredModules;
  } catch (error) {
    logAction(`[kapLBAuth][${functionName}]`, 'Error', error.message);
    return [];
  }
}