
/**
 * File Name   : kapLBHdrLineUpsert.gs
 * PROJECT     : KNIPL LogBook - Sandbox
 * Date        : 19-01-2026
 * Version     : 1.0.0 : Initial Version
 * MODULE      : Global Header and Transaction Line Saver
 * DESCRIPTION : Core function for saving log entries to 
 *              spreadsheet (both master and line records)
 */

function saveDailyLogEntry(payload) {
  var fn = "[saveDailyLogEntry]";
  
  // CRITICAL FIX: Validate essential payload fields
  if (!payload || !payload.masterId || !payload.siteID || !payload.moduleID || !payload.entryDate) {
    KAP.Core.Log.error(fn + " ?? Invalid payload: missing required fields");
    return { 
      ok: false, 
      message: "Invalid request: Missing required information" 
    };
  }
  
  // CRITICAL FIX: Safe logging without sensitive data
  KAP.Core.Log.info(fn + " ?? Save initiated for MasterId: " + payload.masterId + 
    ", Module: " + payload.moduleID + ", Site: " + payload.siteID);

  try {
    // CRITICAL FIX: Validate configuration and sheet existence
    if (!KNIPL_CONFIG || !KNIPL_CONFIG.DATABASE || !KNIPL_CONFIG.DATABASE.INPUT_STORE) {
      throw new Error("Database configuration missing");
    }
    
    var ss = SpreadsheetApp.openById(KNIPL_CONFIG.DATABASE.INPUT_STORE);
    var sheetMaster = ss.getSheetByName(KNIPL_CONFIG.TABS.TXN_MASTER);
    var sheetLines = ss.getSheetByName(KNIPL_CONFIG.TABS.TXN_LINES);
    
    // CRITICAL FIX: Check if sheets exist
    if (!sheetMaster) {
      throw new Error("Master transaction sheet not found: " + KNIPL_CONFIG.TABS.TXN_MASTER);
    }
    if (!sheetLines) {
      throw new Error("Line transaction sheet not found: " + KNIPL_CONFIG.TABS.TXN_LINES);
    }

    var act = payload.activityData || {};
    
    // Calculate totals (keeping current logic, will refactor in Phase 2.0)
    var tTime = parseFloat(act.moduleKey4) || 0;
    var tRead = (parseFloat(act.moduleKey7)||0) + (parseFloat(act.moduleKey10)||0) + 
                (parseFloat(act.moduleKey13)||0) + (parseFloat(act.moduleKey16)||0);
    
    KAP.Core.Log.info(fn + " ?? Calculated: Time=" + tTime + ", Reading=" + tRead);

    // 1. Master Row Assembly
    var masterRow = [
      payload.masterId, payload.siteID, payload.location, payload.village, 
      payload.vehicleID, payload.vehicleID, payload.owner, payload.entryDate, 
      payload.fuelQty || 0, payload.isRefuel ? payload.entryDate : "", 
      payload.odoReading || 0, payload.fuelSource || "", payload.fuelPerson || "",
      payload.moduleID, "", payload.operator, payload.supervisor, payload.siteIncharge, 
      tTime, tRead, "Submitted", payload.remarks || ""
    ];
    
    // CRITICAL FIX: Transaction pattern - save master first
    KAP.Core.Log.info(fn + " ?? Attempting Master Append...");
    var masterRowNum;
    try {
      sheetMaster.appendRow(masterRow);
      // Get the row number we just added (last row)
      masterRowNum = sheetMaster.getLastRow();
      KAP.Core.Log.info(fn + " ? Master Saved at row: " + masterRowNum);
    } catch (masterErr) {
      KAP.Core.Log.error(fn + " ?? Failed to save master: " + masterErr.toString());
      throw new Error("Failed to save master record: " + masterErr.message);
    }

    // 2. Line Row Assembly
    var lineRow = [
      payload.masterId, payload.masterId, payload.moduleID, payload.ccID, 
      act.moduleKey1||"", act.moduleKey2||"", act.moduleKey3||"", act.moduleKey4||"", 
      act.moduleKey5||"", act.moduleKey6||"", act.moduleKey7||"", act.moduleKey8||"", 
      act.moduleKey9||"", act.moduleKey10||"", act.moduleKey11||"", act.moduleKey12||"", 
      act.moduleKey13||"", act.moduleKey14||"", act.moduleKey15||"", act.moduleKey16||"", 
      act.moduleKey17||"", act.moduleKey18||"", act.lineRemarks||"", tTime, tRead, "Submitted"
    ];
    
    // CRITICAL FIX: Attempt to save line, rollback master if fails
    KAP.Core.Log.info(fn + " ?? Attempting Line Append...");
    try {
      sheetLines.appendRow(lineRow);
      var lineRowNum = sheetLines.getLastRow();
      KAP.Core.Log.info(fn + " ? Line Saved at row: " + lineRowNum);
    } catch (lineErr) {
      // ATTEMPT ROLLBACK: Delete the master record we just added
      KAP.Core.Log.error(fn + " ?? Failed to save line. Attempting master rollback...");
      try {
        if (masterRowNum) {
          sheetMaster.deleteRow(masterRowNum);
          KAP.Core.Log.warn(fn + " ? Master row " + masterRowNum + " rolled back");
        }
      } catch (rollbackErr) {
        KAP.Core.Log.error(fn + " ?? CRITICAL: Failed to rollback master: " + rollbackErr.toString());
        // Continue to throw the original error
      }
      throw new Error("Failed to save line record: " + lineErr.message);
    }

    // 3. Final Success Signal (KAP Standard)
    KAP.Core.Log.info(fn + " ?? Process complete. Sending Response.");
    return { 
      ok: true, 
      status: "SUCCESS",
      details: {
        masterRow: masterRowNum,
        timestamp: new Date().toISOString()
      }
    };

  } catch (err) {
    KAP.Core.Log.error(fn + " ?? Critical Error: " + err.toString());
    
    // CRITICAL FIX: Return user-friendly error without internal details
    var userMessage = "Failed to save log entry. ";
    if (err.message && err.message.includes("configuration")) {
      userMessage += "System configuration error.";
    } else if (err.message && err.message.includes("sheet not found")) {
      userMessage += "Database structure error.";
    } else {
      userMessage += "Please try again or contact support.";
    }
    
    return { 
      ok: false, 
      message: userMessage,
      errorCode: "SAVE_FAILED"
    };
  }
}