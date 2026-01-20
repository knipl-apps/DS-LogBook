/**
 * File Name  : kapLBService.gs
 * PROJECT: KNIPL LogBook
 * MODULE: Core Service Orchestrator
 * DESCRIPTION: High-level functions to serve the Frontend. 
 * The "Bootstrap" function called on App Launch.
 * Consolidates data from Master Source and Input Store.
 * Standard: Single-trip data fetch.
 */

// CRITICAL FIX: Ensure required functions are available
// const getAssignedModuleMetadata = getAssignedModuleMetadata || function() { 
//   logAction('kapLBService', 'WARN: getAssignedModuleMetadata not found, using fallback');
//   return []; 
// };

/**
 * PROVIDER 1: Location Funnel
 */
function getMapLocationFunnel() {
  const functionName = 'getMapLocationFunnel';
  
  // CRITICAL FIX: Validate configuration
  if (!KNIPL_CONFIG || !KNIPL_CONFIG.DATABASE || !KNIPL_CONFIG.DATABASE.INPUT_STORE) {
    logAction(functionName, 'Configuration missing', {});
    return {};
  }
  
  try {
    const rawMeta = getMasterDataList(KNIPL_CONFIG.DATABASE.INPUT_STORE, KNIPL_CONFIG.TABS.META);
    const funnel = {};
    
    rawMeta.forEach(row => {
      const sId = row.logSheetSiteID; 
      const vName = row.logSheetSiteVillage;
      const lName = row.logSheetSiteLocId;
      
      if (!sId || !vName) return; 
      
      if (!funnel[sId]) funnel[sId] = {};
      if (!funnel[sId][vName]) funnel[sId][vName] = [];
      
      if (lName && !funnel[sId][vName].includes(lName)) {
        funnel[sId][vName].push(lName);
      }
    });
    
    return funnel;
  } catch (error) {
    logAction(functionName, 'Error building location funnel', { error: error.message });
    return {};
  }
}

/**
 * PROVIDER 2: Hybrid Fuel Mapping
 */
function getHybridFuelMapping() {
  const functionName = 'getHybridFuelMapping';
  
  // CRITICAL FIX: Validate configuration
  if (!KNIPL_CONFIG || !KNIPL_CONFIG.DATABASE) {
    logAction(functionName, 'Configuration missing', {});
    return { tankers: [], siteGasMap: {} };
  }
  
  try {
    const allVehicles = getMasterDataList(KNIPL_CONFIG.DATABASE.MASTER_SOURCE, KNIPL_CONFIG.TABS.VEHICLES);
    const allMeta = getMasterDataList(KNIPL_CONFIG.DATABASE.INPUT_STORE, KNIPL_CONFIG.TABS.META);
    
    const tankers = allVehicles
      .filter(v => v.vehicleMake === 'Diesel Tanker' && String(v.isActive || '').toUpperCase() === 'Y')
      .map(v => ({ 
        id: v.vehicleRegnNo, 
        name: `??: ${v.vehicleRegnNo}`, 
        type: 'TANKER' 
      }));
    
    const siteGasMap = {};
    
    allMeta.forEach(meta => {
      const siteId = meta.logSheetSiteID;
      const rawStations = meta.logSheetSiteGasStations;
      
      if (siteId && rawStations) {
        if (!siteGasMap[siteId]) siteGasMap[siteId] = [];
        
        const stationsArray = String(rawStations).split(',').map(s => s.trim());
        
        stationsArray.forEach(stationName => {
          if (!stationName) return;
          
          const alreadyExists = siteGasMap[siteId].some(p => p.id === stationName);
          
          if (!alreadyExists) {
            siteGasMap[siteId].push({
              id: stationName,
              name: `?: ${stationName}`,
              type: 'PUMP'
            });
          }
        });
      }
    });
    
    return { tankers, siteGasMap };
  } catch (error) {
    logAction(functionName, 'Error building fuel mapping', { error: error.message });
    return { tankers: [], siteGasMap: {} };
  }
}

/**
 * MODULAR BOOTSTRAP: getInitialAppData
 */
function getInitialAppData(userContext) {
  const functionName = 'kapLBService.gs - getInitialAppData';
  let finalResponse;
  
  try {
    if (!userContext) {
      throw new Error("Initialization failed: User context missing.");
    }

    // CRITICAL FIX: Validate configuration
    if (!KNIPL_CONFIG || !KNIPL_CONFIG.DATABASE) {
      throw new Error("Configuration not loaded");
    }

    const locations = getMapLocationFunnel(); 
    const fuel = getHybridFuelMapping();      
    
    // 1. Fetch Sites
    const sitesRaw = getMasterDataList(KNIPL_CONFIG.DATABASE.MASTER_SOURCE, KNIPL_CONFIG.TABS.SITES);
    const sites = sitesRaw.map(s => ({ id: s.SiteID, name: s.SiteName }));
    
    // 2. Fetch Vehicles
    const vehiclesRaw = getMasterDataList(KNIPL_CONFIG.DATABASE.MASTER_SOURCE, KNIPL_CONFIG.TABS.VEHICLES);
    const slimVehicles = vehiclesRaw.filter(v => v.vehicleRegnNo).map(v => ({
      vehicleRegnNo: String(v.vehicleRegnNo || "").trim(),
      vehicleMake: String(v.vehicleMake || "").trim(),
      vehicleType: String(v.vehicleType || "General").trim(),
      ownedRented: String(v.ownedRented || "Unknown").trim(),
      isActive: v.isActive
    }));

    // 3. Fetch Cost Centers
    const ccListRaw = getMasterDataList(KNIPL_CONFIG.DATABASE.INPUT_STORE, KNIPL_CONFIG.TABS.COST_CENTERS);
    const ccList = ccListRaw.map(cc => ({ 
      id: cc.logModCCId, 
      name: cc.logModCCName,
      logSheetModuleID: cc.logSheetModuleID
    }));

    // 4. CRITICAL FIX: Use config for sheet name
    const metaRaw = getMasterDataList(KNIPL_CONFIG.DATABASE.INPUT_STORE, KNIPL_CONFIG.TABS.META);
    const meta = metaRaw.map(m => ({
      logSheetSiteID: m.logSheetSiteID,
      logSheetSitePerRole: m.logSheetSitePerRole,
      logSheetSitePerName: m.logSheetSitePerName
    }));
    
    // 5. Fetch Modules
    const moduleMetadata = getAssignedModuleMetadata(userContext.allowedModuleIds);
    const modules = getModuleUISchema(moduleMetadata);   

    // 6. ASSEMBLE PAYLOAD
    const payload = {
      userName: userContext.knownAs || userContext.fullName,
      user: userContext,
      modules: modules,
      locations: locations,
      fuel: fuel,
      sites: sites,
      meta: meta,
      master: { vehicles: slimVehicles, costCenters: ccList },
      needsLogin: false
    };

    finalResponse = { ok: true, data: payload, error: null };
    
  } catch (e) {
    logAction(functionName, 'FAILED: ' + e.message, { error: e.message });
    finalResponse = { ok: false, data: null, error: { message: e.message } };
  }
  
  return finalResponse;
}

/**
 * Dashboard Logic (Label-Based Fix)
 */
function getDashboardLogs(personId) {
  const functionName = 'getDashboardLogs';
  
  try {
    // CRITICAL FIX: Validate input
    if (!personId) {
      logAction(functionName, 'personId is required', {});
      return { drafts: [], finalized: [] };
    }
    
    const ss = SpreadsheetApp.openById(KNIPL_CONFIG.DATABASE.INPUT_STORE);
    const masterSheet = ss.getSheetByName(KNIPL_CONFIG.TABS.TXN_MASTER);
    
    if (!masterSheet) {
      logAction(functionName, 'Master sheet not found', { sheet: KNIPL_CONFIG.TABS.TXN_MASTER });
      return { drafts: [], finalized: [] };
    }
    
    const data = masterSheet.getDataRange().getValues();
    const headers = data.shift();
    
    // Convert to objects
    const allLogs = mapRowsToObjects(headers, data);
    
    // CRITICAL FIX: Use header mapping for column names
    const operatorCol = headers.find(h => h.toLowerCase().includes('operator'));
    const supervisorCol = headers.find(h => h.toLowerCase().includes('supervisor'));
    const statusCol = headers.find(h => h.toLowerCase().includes('status'));
    const dateCol = headers.find(h => h.toLowerCase().includes('date'));
    
    const userLogs = allLogs.filter(log => {
      const opId = operatorCol ? log[operatorCol] : null;
      const supId = supervisorCol ? log[supervisorCol] : null;
      return opId === personId || supId === personId;
    });
    
    const drafts = userLogs.filter(log => 
      log[statusCol || 'logSheetStatus'] === KNIPL_CONFIG.UI_SETTINGS.DRAFT_STATUS
    );
    
    const finalized = userLogs
      .filter(log => 
        log[statusCol || 'logSheetStatus'] === KNIPL_CONFIG.UI_SETTINGS.FINALIZED_STATUS
      )
      .sort((a, b) => {
        const dateA = new Date(a[dateCol || 'logSheetDate'] || 0);
        const dateB = new Date(b[dateCol || 'logSheetDate'] || 0);
        return dateB - dateA;
      })
      .slice(0, 4);
    
    return { drafts, finalized };
  } catch (error) {
    logAction(functionName, 'Error fetching dashboard logs', { error: error.message });
    return { drafts: [], finalized: [] };
  }
}

/**
 * Generic Fetcher (Row 3+ Protocol) - CRITICAL FIX: Added error handling
 */
function getMasterDataList(ssId, sheetName) {
  const functionName = 'getMasterDataList';
  
  if (!ssId || !sheetName) {
    logAction(functionName, 'Missing required parameters', { ssId, sheetName });
    return [];
  }
  
  try {
    const ss = SpreadsheetApp.openById(ssId);
    const sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      logAction(functionName, 'Sheet not found', { ssId, sheetName });
      return [];
    }
    
    const allRows = sheet.getDataRange().getValues();
    
    if (allRows.length === 0) {
      return [];
    }
    
    const headers = allRows[0];
    
    // FIXED LOGIC: Skip Row 2 (Index 1) ONLY for "Sites" and "Vehicles"
    const isMaster = (sheetName === "Sites" || sheetName === "Vehicles");
    const data = allRows.slice(isMaster ? 2 : 1); 
    
    return mapRowsToObjects(headers, data);
  } catch (error) {
    logAction(functionName, 'Error fetching master data', { ssId, sheetName, error: error.message });
    return [];
  }
}

/**
 * Utility: Row to Object
 */
function mapRowsToObjects(headers, rows) {
  return rows.map(row => {
    let obj = {};
    headers.forEach((header, i) => {
      if (header) { // Skip empty headers
        obj[header] = row[i];
      }
    });
    return obj;
  });
}

/**
 * Schema Generator - CRITICAL FIX: Align with configuration
 */
function getModuleUISchema(moduleMetadata) {
  return moduleMetadata.map(module => {
    const schema = {
      moduleId: module.logSheetModuleID,
      moduleName: module.logSheetModuleName,
      fields: {}
    };
    
    // Use configuration for field mapping if available
    const timeGroup = KNIPL_CONFIG.MODULE_SCHEMA.TIME_GROUP;
    const readingGroups = KNIPL_CONFIG.MODULE_SCHEMA.READING_GROUPS;
    
    // Build result field indices from config
    const resultFieldIndices = new Set();
    if (timeGroup && timeGroup.RESULT) {
      const resultKey = timeGroup.RESULT;
      const resultIndex = parseInt(resultKey.replace('moduleKey', ''));
      if (!isNaN(resultIndex)) resultFieldIndices.add(resultIndex);
    }
    
    readingGroups.forEach(group => {
      if (group.RESULT) {
        const resultIndex = parseInt(group.RESULT.replace('moduleKey', ''));
        if (!isNaN(resultIndex)) resultFieldIndices.add(resultIndex);
      }
    });
    
    for (let i = 1; i <= 18; i++) {
      const key = `moduleKey${i}`;
      const labelValue = module[key];
      
      if (labelValue && String(labelValue).trim() !== "") {
        let type = 'text';
        if (i === 1) type = 'date';
        if (i >= 2 && i <= 3) type = 'time';
        if (i >= 4 && i <= 16) type = 'number';
        
        const isResultField = resultFieldIndices.has(i);
        
        schema.fields[key] = {
          label: labelValue,
          type: type,
          isDisabled: isResultField, 
          isResult: isResultField,
          calcGroup: i >= 2 && i <= 4 ? 'TIME' : (i >= 5 && i <= 16 ? 'WORKING_HOURS' : null)
        };
      }
    }
    return schema;
  });
}

/**
 * Logic Gate: Calculations - CRITICAL FIX: Exact string comparison
 */
function validateAndCalculateRow(rowObject) {
  const triggers = KNIPL_CONFIG.MODULE_SCHEMA.STATUS_TRIGGERS;
  let processedRow = { ...rowObject };
  
  // CRITICAL FIX: Use exact match for trigger comparison
  const ccId = String(processedRow['logModCCId'] || '').toUpperCase().trim();
  const isIdle = ccId === triggers.IDLE.toUpperCase();
  const isBreakdown = ccId === triggers.BREAKDOWN.toUpperCase();
  
  KNIPL_CONFIG.MODULE_SCHEMA.READING_GROUPS.forEach(group => {
    if (processedRow[group.START] !== undefined) {
      const startVal = Number(processedRow[group.START] || 0);
      const endVal = Number(processedRow[group.END] || 0);
      
      if (isIdle) {
        processedRow[group.END] = startVal;
        processedRow[group.RESULT] = 0;
      } else {
        processedRow[group.RESULT] = endVal - startVal;
      }
    }
  });
  
  return processedRow;
}