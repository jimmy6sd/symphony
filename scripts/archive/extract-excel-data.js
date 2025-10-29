/**
 * Excel Data Extractor
 *
 * Extracts budget, projection, and audience data from the KCS Weekly Sales Report Excel file
 * and outputs structured JSON for integration with PDF webhook data.
 *
 * ASSUMPTIONS:
 * - Excel file is in root directory: "KCS 25-26 Weekly Sales Report - Sep 17.xlsx"
 * - Sheet structure matches the Sep 17, 2025 format
 * - Performance names in Excel will need fuzzy matching to PDF data
 *
 * OUTPUT:
 * - data/excel-extracted.json: Structured data ready for merging
 *
 * USAGE:
 * node scripts/extract-excel-data.js [path-to-excel-file]
 */

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  defaultExcelPath: 'KCS 25-26 Weekly Sales Report - Sep 17.xlsx',
  outputPath: 'data/excel-extracted.json',
  sheets: {
    board: 'Board',
    performancesByWeek: 'Performances by Week',
    summary: 'Summary (Draft)'
  }
};

/**
 * Main extraction function
 */
function extractExcelData(excelFilePath) {
  console.log(`📊 Extracting data from: ${excelFilePath}`);

  // Load workbook
  const workbook = XLSX.readFile(excelFilePath);
  console.log(`✅ Loaded workbook with ${workbook.SheetNames.length} sheets`);

  // Extract data from key sheets
  const boardData = extractBoardData(workbook);
  const weeklyData = extractPerformancesByWeek(workbook);
  const individualPerformances = extractIndividualPerformanceSheets(workbook);

  // Combine into unified structure
  const extractedData = {
    extractedAt: new Date().toISOString(),
    sourceFile: path.basename(excelFilePath),
    performances: mergePerformanceData(boardData, weeklyData, individualPerformances)
  };

  // Write output
  ensureDirectoryExists(path.dirname(CONFIG.outputPath));
  fs.writeFileSync(CONFIG.outputPath, JSON.stringify(extractedData, null, 2));

  console.log(`✅ Extracted ${extractedData.performances.length} performances`);
  console.log(`📁 Output written to: ${CONFIG.outputPath}`);

  return extractedData;
}

/**
 * Extract budget and capacity data from Board sheet
 *
 * BOARD SHEET STRUCTURE:
 * Row 1: Headers (SERIES, DATE(S), BUDGET, ACTUAL, etc.)
 * Row 2+: Performance data
 */
function extractBoardData(workbook) {
  console.log('\n📋 Extracting Board sheet data...');

  const sheet = workbook.Sheets[CONFIG.sheets.board];
  if (!sheet) {
    console.warn('⚠️  Board sheet not found');
    return [];
  }

  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  // Find header row (contains "SERIES", "DATE(S)", "BUDGET", etc.)
  const headerRowIndex = data.findIndex(row =>
    row.includes('SERIES') && row.includes('DATE(S)') && row.includes('BUDGET')
  );

  if (headerRowIndex === -1) {
    console.warn('⚠️  Could not find header row in Board sheet');
    return [];
  }

  const headers = data[headerRowIndex];
  const performances = [];

  // Process data rows (skip header and category rows)
  for (let i = headerRowIndex + 1; i < data.length; i++) {
    const row = data[i];

    // Skip empty rows or category headers
    if (!row[0] || row[0].includes('TOTAL') || row[0].includes('PIAZZA')) {
      continue;
    }

    // Extract performance data
    const seriesCode = row[0]?.toString().trim();
    const performanceName = row[1]?.toString().trim();
    const dateRange = row[3]?.toString().trim();

    if (!seriesCode || !performanceName || !dateRange) {
      continue; // Skip incomplete rows
    }

    const performance = {
      seriesCode,
      performanceName,
      dateRange,
      budget: {
        singleTickets: parseFloat(row[4]) || 0,
        singleTicketsSold: parseInt(row[7]) || 0,
        subscriptionTickets: parseFloat(row[8]) || 0,
        subscriptionTicketsSold: parseInt(row[10]) || 0,
        total: parseFloat(row[11]) || 0,
        totalTicketsSold: parseInt(row[13]) || 0
      },
      actual: {
        singleRevenue: parseFloat(row[5]) || 0,
        singleTicketsSold: parseInt(row[7]) || 0,
        singleATP: parseFloat(row[16]) || 0,
        subscriptionRevenue: parseFloat(row[9]) || 0,
        subscriptionTicketsSold: parseInt(row[10]) || 0,
        totalRevenue: parseFloat(row[12]) || 0,
        totalTicketsSold: parseInt(row[13]) || 0
      },
      capacity: {
        total: parseInt(row[14]) || 0,
        occupancyPercent: parseFloat(row[15]) || 0
      },
      variance: {
        singleRevenue: parseFloat(row[6]) || 0
      }
    };

    performances.push(performance);
  }

  console.log(`✅ Extracted ${performances.length} performances from Board sheet`);
  return performances;
}

/**
 * Extract weekly tracking data from Performances by Week sheet
 *
 * PERFORMANCES BY WEEK STRUCTURE:
 * Row 4: Headers (Wk #, Performance, Performance Date(s), Performance Type, etc.)
 * Row 5+: Weekly performance data with projections and audience info
 */
function extractPerformancesByWeek(workbook) {
  console.log('\n📅 Extracting Performances by Week data...');

  const sheet = workbook.Sheets[CONFIG.sheets.performancesByWeek];
  if (!sheet) {
    console.warn('⚠️  Performances by Week sheet not found');
    return [];
  }

  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  // Find header row (contains "Performance", "Performance Date(s)", etc.)
  const headerRowIndex = data.findIndex(row =>
    row.includes('Performance') && row.includes('Performance Type')
  );

  if (headerRowIndex === -1) {
    console.warn('⚠️  Could not find header row in Performances by Week sheet');
    return [];
  }

  const performances = [];

  // Process data rows
  for (let i = headerRowIndex + 1; i < data.length; i++) {
    const row = data[i];

    // Skip empty rows or placeholder rows
    if (!row[3] || row[3].includes('OPEN')) {
      continue;
    }

    const performanceName = row[3]?.toString().trim();
    const performanceDate = row[6]; // Excel date serial or formatted date
    const performanceType = row[7]?.toString().trim();

    if (!performanceName || !performanceDate) {
      continue;
    }

    const performance = {
      weekNumber: parseInt(row[0]) || null,
      weeksUntilPerformance: parseInt(row[1]) || null,
      performanceName,
      performanceDate: parseExcelDate(performanceDate),
      performanceType,

      // Current sales data
      actualTickets: {
        total: parseInt(row[8]) || 0,
        single: parseInt(row[15]) || 0,
        subscription: parseInt(row[23]) || 0
      },

      // Projections
      projected: {
        singleTickets: parseFloat(row[17]) || null,
        totalTickets: parseFloat(row[9]) || null,
        occupancy: parseFloat(row[10]) || null
      },

      // Targets
      targets: {
        singleTicketsFor85Occ: parseFloat(row[16]) || null
      },

      // Revenue
      revenue: {
        total: parseFloat(row[11]) || 0,
        single: parseFloat(row[19]) || 0,
        subscription: parseFloat(row[24]) || 0
      },

      // Budget
      budget: {
        total: parseFloat(row[12]) || 0,
        single: parseFloat(row[20]) || 0,
        subscription: parseFloat(row[25]) || 0
      },

      // Budget achievement
      budgetAchievement: {
        total: parseFloat(row[13]) || null,
        single: parseFloat(row[21]) || null,
        subscription: parseFloat(row[26]) || null
      },

      // Capacity and occupancy
      capacity: {
        max: parseInt(row[27]) || 0,
        currentOccupancy: parseFloat(row[28]) || 0
      },

      // Pricing
      singleTicketATP: parseFloat(row[29]) || 0,

      // Audience intelligence
      audience: {
        newHouseholds: parseInt(row[30]) || 0,
        returningHouseholds: parseInt(row[31]) || 0,
        totalHouseholds: parseInt(row[32]) || 0
      },

      // Sales velocity (if available)
      salesVelocity: {
        revenueLastWeek: parseFloat(row[33]) || null,
        weeklyIncrease: parseFloat(row[34]) || null
      }
    };

    performances.push(performance);
  }

  console.log(`✅ Extracted ${performances.length} weekly performance records`);
  return performances;
}

/**
 * Extract pacing models from individual performance sheets (CS1, PS1, etc.)
 *
 * INDIVIDUAL SHEET STRUCTURE:
 * Tracks week-by-week expected pacing for specific performances
 */
function extractIndividualPerformanceSheets(workbook) {
  console.log('\n🎭 Extracting individual performance pacing data...');

  // Performance sheet names to look for
  const performanceSheetPrefixes = ['CS', 'PS', 'FS', 'Piazza'];
  const performanceSheets = workbook.SheetNames.filter(name =>
    performanceSheetPrefixes.some(prefix => name.startsWith(prefix))
  );

  const pacingModels = {};

  performanceSheets.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    // Look for pacing data structure
    // Row 2 typically has: "Single Tickets", then week numbers
    // Row 3+: Performance dates and actual sales per week

    const pacingData = {
      sheetName,
      performances: []
    };

    // Find the row with week headers (10, 9, 8, 7, etc.)
    const weekHeaderRow = data.find(row =>
      row.includes(10) || row.includes('# Weeks Until Performance')
    );

    if (weekHeaderRow) {
      // Extract week-by-week data
      // This structure varies per sheet, so we'll store the raw data
      pacingData.rawData = data.slice(0, 10); // First 10 rows contain the structure
    }

    pacingModels[sheetName] = pacingData;
  });

  console.log(`✅ Extracted pacing models for ${Object.keys(pacingModels).length} performance series`);
  return pacingModels;
}

/**
 * Merge data from different sheets into unified performance objects
 */
function mergePerformanceData(boardData, weeklyData, pacingModels) {
  console.log('\n🔄 Merging performance data from all sources...');

  // Use weeklyData as base (most complete)
  const merged = weeklyData.map(weekly => {
    // Find matching board data by performance name
    const boardMatch = boardData.find(board =>
      normalizePerformanceName(board.performanceName) === normalizePerformanceName(weekly.performanceName)
    );

    // Find matching pacing model by series code
    const seriesCode = extractSeriesCode(weekly.performanceName);
    const pacingModel = pacingModels[seriesCode] || null;

    return {
      // Base identification
      performanceName: weekly.performanceName,
      performanceDate: weekly.performanceDate,
      performanceType: weekly.performanceType,
      seriesCode: boardMatch?.seriesCode || seriesCode,
      dateRange: boardMatch?.dateRange || null,

      // Timing
      weekNumber: weekly.weekNumber,
      weeksUntilPerformance: weekly.weeksUntilPerformance,

      // Current sales
      actualTickets: weekly.actualTickets,
      revenue: weekly.revenue,

      // Budget (prefer weekly data, fallback to board)
      budget: {
        total: weekly.budget.total || boardMatch?.budget.total || 0,
        single: weekly.budget.single || boardMatch?.budget.singleTickets || 0,
        subscription: weekly.budget.subscription || boardMatch?.budget.subscriptionTickets || 0
      },

      // Projections
      projected: weekly.projected,
      targets: weekly.targets,

      // Budget achievement
      budgetAchievement: weekly.budgetAchievement,

      // Capacity
      capacity: {
        max: weekly.capacity.max || boardMatch?.capacity.total || 0,
        currentOccupancy: weekly.capacity.currentOccupancy || boardMatch?.capacity.occupancyPercent || 0
      },

      // Pricing
      pricing: {
        singleATP: weekly.singleTicketATP || boardMatch?.actual.singleATP || 0
      },

      // Audience
      audience: weekly.audience,

      // Sales velocity
      salesVelocity: weekly.salesVelocity,

      // Pacing model reference
      pacingModel: pacingModel ? { available: true, sheetName: pacingModel.sheetName } : null
    };
  });

  console.log(`✅ Merged ${merged.length} performance records`);
  return merged;
}

/**
 * Helper: Parse Excel date (serial number or string)
 */
function parseExcelDate(excelDate) {
  if (typeof excelDate === 'number') {
    // Excel date serial number (days since 1900-01-01)
    const date = XLSX.SSF.parse_date_code(excelDate);
    return new Date(date.y, date.m - 1, date.d).toISOString().split('T')[0];
  } else if (typeof excelDate === 'string') {
    return excelDate;
  }
  return null;
}

/**
 * Helper: Normalize performance names for matching
 */
function normalizePerformanceName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/^(26|cs\d+|ps\d+|fs\d+)\s+/i, '') // Remove series prefix
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Helper: Extract series code from performance name
 */
function extractSeriesCode(name) {
  if (!name) return null;
  const match = name.match(/^(CS\d+|PS\d+|FS\d+)/i);
  return match ? match[1].toUpperCase() : null;
}

/**
 * Helper: Ensure directory exists
 */
function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * CLI execution
 */
if (require.main === module) {
  const excelPath = process.argv[2] || CONFIG.defaultExcelPath;

  if (!fs.existsSync(excelPath)) {
    console.error(`❌ Excel file not found: ${excelPath}`);
    console.log('Usage: node scripts/extract-excel-data.js [path-to-excel-file]');
    process.exit(1);
  }

  try {
    const result = extractExcelData(excelPath);
    console.log('\n✅ Excel data extraction complete!');
    console.log(`📊 Extracted ${result.performances.length} performances`);
    console.log(`📁 Data saved to: ${CONFIG.outputPath}`);
  } catch (error) {
    console.error('❌ Extraction failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

module.exports = {
  extractExcelData,
  extractBoardData,
  extractPerformancesByWeek,
  extractIndividualPerformanceSheets
};
