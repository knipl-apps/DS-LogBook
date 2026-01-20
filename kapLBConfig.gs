/**
 * File Name  : kapLBConfig.gs
 * PROJECT: KNIPL LogBook
 * MODULE: Configuration & Global Registry
 * DESCRIPTION: Centralized configuration for the "Chameleon" UI and Backend.
 */

// CRITICAL FIX: Load sensitive IDs from Script Properties
const scriptProperties = PropertiesService.getScriptProperties();

const KNIPL_CONFIG = {
  // 1. DATABASE IDs (CRITICAL FIX: From Script Properties with fallback)
  DATABASE: {
    MASTER_SOURCE: scriptProperties.getProperty('MASTER_SOURCE_ID') || '1jbuYNsQJw5_fnEWShTqOhRNLUhvmJSh9gyjuHMpXggQ',
    INPUT_STORE: scriptProperties.getProperty('INPUT_STORE_ID') || '1Ii24KShYzvgJxg9K0BOV1YFWq501kUVF6laNiaKsgyo',
  },

  // 2. SHEET/TAB NAMES
  TABS: {
    LOGGERS: 'LogSheetLoggers',
    META: 'LogSheetMeta',
    MODULES: 'LogSheetModules',
    COST_CENTERS: 'LogModuleCCs',
    TXN_MASTER: 'LogSheetTxnMaster',
    TXN_LINES: 'LogSheetTxnLines',
    AUDIT: 'LogSheetAuditLogs',
    SITES: 'Sites',    // From Master Source
    VEHICLES: 'Vehicles' // From Master Source
  },

  // 3. UI BEHAVIOR & MAPPINGS
  UI_SETTINGS: {
    APP_TITLE: 'KNIPL LogBook',
    APP_SUBTITLE: 'Daily Operations Log',
    DRAFT_STATUS: 'Draft',
    FINALIZED_STATUS: 'Finalized',
    AUTO_SAVE_INTERVAL: 60000, // 60 Seconds
  },

  // 4. THE "BRAIN": DYNAMIC COLUMN MAPPING & MATH RULES
  MODULE_SCHEMA: {
    // Group 1: Time & Duration
    TIME_GROUP: {
      START: 'moduleKey2',
      END: 'moduleKey3',
      RESULT: 'moduleKey4', // Sub Total of Time
      TYPE: 'TIME'
    },
    // Groups 2-5: Reading & Calculations (Sub Total of Working Hours)
    READING_GROUPS: [
      { START: 'moduleKey5', END: 'moduleKey6', RESULT: 'moduleKey7', TYPE: 'WORKING_HOURS' },
      { START: 'moduleKey8', END: 'moduleKey9', RESULT: 'moduleKey10', TYPE: 'WORKING_HOURS' },
      { START: 'moduleKey11', END: 'moduleKey12', RESULT: 'moduleKey13', TYPE: 'WORKING_HOURS' },
      { START: 'moduleKey14', END: 'moduleKey15', RESULT: 'moduleKey16', TYPE: 'WORKING_HOURS' }
    ],
    // 5. LOGIC GATE CONSTANTS (Trigger IDs for Idle/Breakdown)
    STATUS_TRIGGERS: {
      IDLE: 'Idle',
      BREAKDOWN: 'Breakdown'
    }
  },

  // 5. PDF TEMPLATE MAPPING (Placeholder for later)
  PDF_MAPPING: {
    TEMPLATE_NAME: 'KNIPL_LogSheet_Template',
    CELLS: {
      MASTER_ID: 'B2',
      DATE: 'F2',
      SITE: 'B4',
      MODULE: 'F4'
    }
  }
};

/**
 * KAP CORE LOGGING UTILITY WRAPPER
 * Standard: [FileName][FunctionName] + [Message]
 */
function logAction(functionName, message, data = null) {
  const fileName = 'kapLBConfig.gs';
  const timestamp = new Date().toISOString();
  
  // Ensure message is never undefined
  const safeMessage = message || "Executing...";
  let logMsg = `[${fileName}][${functionName}] ${safeMessage}`;
  
  // CRITICAL FIX: Safe JSON stringification with circular reference handling
  if (data) {
    try {
      // Limit data size to prevent logging bloat
      const dataStr = JSON.stringify(data, null, 2);
      // Truncate if too long (50KB limit for Logger)
      logMsg += ` | Data: ${dataStr.length > 10000 ? dataStr.substring(0, 10000) + '... [TRUNCATED]' : dataStr}`;
    } catch (e) {
      logMsg += ` | Data: [Unserializable: ${typeof data}]`;
    }
  }
  
  try {
    // If KAP library is present but specific logger fails, fallback to Logger
    if (typeof KAP !== 'undefined' && KAP.Core && KAP.Core.Logger) {
      KAP.Core.Logger.log(logMsg);
    } else {
      Logger.log(logMsg);
    }
  } catch (e) {
    Logger.log("[Fallback] " + logMsg);
  }
}

/**
 * BOOTSTRAP: Get all initial data for the "Fighter Aircraft" load
 * CRITICAL FIX: Clarify this function's purpose - currently uses Session.getActiveUser()
 * which may not align with your email-based auth system
 */
function getAppInitData() {
  const userEmail = Session.getActiveUser().getEmail();
  logAction('getAppInitData', 'User Access Check', { email: userEmail });
  
  // LOGIC TO FOLLOW: This function's usage needs review
  // If it's for admin purposes, keep. If for user auth, use custom auth system.
  return {
    userEmail: userEmail,
    config: KNIPL_CONFIG
  };
}

// CRITICAL FIX: Configuration validation function
function validateConfig() {
  const requiredPaths = [
    'DATABASE.MASTER_SOURCE',
    'DATABASE.INPUT_STORE',
    'TABS.LOGGERS',
    'TABS.MODULES',
    'UI_SETTINGS.APP_TITLE'
  ];
  
  const missing = [];
  
  for (const path of requiredPaths) {
    const keys = path.split('.');
    let current = KNIPL_CONFIG;
    
    for (const key of keys) {
      if (!current[key]) {
        missing.push(path);
        break;
      }
      current = current[key];
    }
  }
  
  if (missing.length > 0) {
    throw new Error(`Configuration validation failed. Missing: ${missing.join(', ')}`);
  }
  
  return true;
}