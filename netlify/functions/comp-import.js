const { BigQuery } = require('@google-cloud/bigquery');
const { v4: uuidv4 } = require('uuid');
const XLSX = require('xlsx');

const DATASET_ID = process.env.BIGQUERY_DATASET || 'symphony_dashboard';
const TABLE_ID = 'performance_sales_comparisons';

const initializeBigQuery = () => {
  const credentialsEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credentialsEnv) {
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS environment variable not set');
  }

  let credentials;
  if (credentialsEnv.startsWith('{')) {
    credentials = JSON.parse(credentialsEnv);
  } else {
    const fs = require('fs');
    const path = require('path');
    credentials = JSON.parse(fs.readFileSync(path.resolve(credentialsEnv), 'utf8'));
  }

  if (credentials.private_key && credentials.private_key.includes('\\\\n')) {
    credentials.private_key = credentials.private_key.replace(/\\\\n/g, '\n');
  }

  return new BigQuery({
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || credentials.project_id,
    credentials: {
      client_email: credentials.client_email,
      private_key: credentials.private_key,
    },
    location: 'US'
  });
};

function parseNumber(val) {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return isNaN(val) ? null : Math.round(val);
  const str = String(val).trim();
  if (str === '' || str === '-') return null;
  const num = parseFloat(str.replace(/,/g, ''));
  return isNaN(num) ? null : Math.round(num);
}

function parsePercent(val) {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return isNaN(val) ? null : val * 100;
  const str = String(val).trim();
  if (str === '' || str === '-') return null;
  const num = parseFloat(str.replace(/%/g, ''));
  return isNaN(num) ? null : num;
}

function parseATP(val) {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return isNaN(val) ? null : val;
  const str = String(val).trim();
  if (str === '' || str === '-') return null;
  const num = parseFloat(str.replace(/\$/g, '').replace(/,/g, ''));
  return isNaN(num) ? null : num;
}

function parseDate(val) {
  if (val === null || val === undefined || val === '') return null;
  try {
    if (typeof val === 'number') {
      const excelEpoch = new Date(1899, 11, 30);
      const date = new Date(excelEpoch.getTime() + val * 24 * 60 * 60 * 1000);
      if (isNaN(date.getTime())) return null;
      return date.toISOString().split('T')[0];
    }
    const str = String(val).trim();
    if (str === '' || str === '-') return null;
    const date = new Date(str);
    if (isNaN(date.getTime())) return null;
    return date.toISOString().split('T')[0];
  } catch {
    return null;
  }
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { fileData } = JSON.parse(event.body);
    if (!fileData) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'No file data provided' }) };
    }

    const buffer = Buffer.from(fileData, 'base64');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (rows.length < 15) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: `File has only ${rows.length} rows — expected at least 15 (headers + defaults + data)` }) };
    }

    const GLOBAL_DEFAULT = rows[12];
    const PIAZZA_DEFAULT = rows[13];

    const stats = {
      imported: 0,
      skipped: 0,
      usedGlobalDefault: 0,
      usedPiazzaDefault: 0,
      withMetadata: 0,
      targetComps: 0,
      errors: []
    };

    const insertRows = [];
    const now = new Date().toISOString();

    for (let i = 14; i < rows.length; i++) {
      const row = rows[i];

      if (!row[0] || String(row[0]).trim() === '') continue;

      const performanceId = String(row[0]).trim();
      const targetFlag = String(row[1] || '').trim().toLowerCase();
      const compDesc = row[3] ? String(row[3]).trim() : '';

      if (!compDesc) {
        stats.skipped++;
        continue;
      }

      let sourceRow;
      let comparisonName;

      if (compDesc === 'Piazza Default') {
        sourceRow = PIAZZA_DEFAULT;
        comparisonName = 'Piazza Default (Historical Avg)';
        stats.usedPiazzaDefault++;
      } else if (compDesc === 'Global Default') {
        sourceRow = GLOBAL_DEFAULT;
        comparisonName = 'Global Default (Historical Avg)';
        stats.usedGlobalDefault++;
      } else {
        sourceRow = row;
        comparisonName = compDesc;
      }

      const compDate = parseDate(row[4]);

      const weekValues = [];
      let hasData = false;
      for (let j = 5; j <= 15; j++) {
        const value = parseNumber(sourceRow[j]);
        weekValues.push(value);
        if (value !== null) hasData = true;
      }

      const finalValue = parseNumber(sourceRow[16]);
      if (finalValue !== null) {
        weekValues.push(finalValue);
        hasData = true;
      }

      if (!hasData) {
        stats.skipped++;
        continue;
      }

      const weeksDataCSV = weekValues.map(v => v !== null ? v : '').join(',');

      const subs = parseNumber(sourceRow[17]);
      const capacity = parseNumber(sourceRow[18]);
      const occPercent = parsePercent(sourceRow[19]);
      const atp = parseATP(sourceRow[20]);

      if (compDate || atp || subs || capacity || occPercent) {
        stats.withMetadata++;
      }

      const isTarget = targetFlag !== '';
      if (isTarget) stats.targetComps++;

      insertRows.push({
        comparisonId: uuidv4(),
        performanceId,
        comparisonName,
        weeksDataCSV,
        lineColor: isTarget ? '#ff6b35' : '#4285f4',
        lineStyle: isTarget ? 'solid' : 'dashed',
        isTarget,
        compDate,
        atp,
        subs,
        capacity,
        occPercent,
        now
      });

      stats.imported++;
    }

    const bigquery = initializeBigQuery();
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;

    await bigquery.query({
      query: `DELETE FROM \`${projectId}.${DATASET_ID}.${TABLE_ID}\` WHERE source = 'excel_import' OR source IS NULL`,
      location: 'US'
    });

    if (insertRows.length > 0) {
      const sqlStr = v => v === null ? 'NULL' : `'${String(v).replace(/'/g, "\\'")}'`;
      const sqlNum = v => v === null ? 'NULL' : String(v);
      const sqlBool = v => v ? 'TRUE' : 'FALSE';
      const sqlDate = v => v === null ? 'NULL' : `DATE '${v}'`;
      const sqlTs = v => `TIMESTAMP '${v}'`;

      const valueTuples = insertRows.map(r =>
        `(${sqlStr(r.comparisonId)}, ${sqlStr(r.performanceId)}, ${sqlStr(r.comparisonName)}, ${sqlStr(r.weeksDataCSV)}, ${sqlStr(r.lineColor)}, ${sqlStr(r.lineStyle)}, ${sqlBool(r.isTarget)}, ${sqlDate(r.compDate)}, ${sqlNum(r.atp)}, ${sqlNum(r.subs)}, ${sqlNum(r.capacity)}, ${sqlNum(r.occPercent)}, 'excel_import', ${sqlTs(r.now)}, ${sqlTs(r.now)})`
      );

      const CHUNK_SIZE = 50;
      for (let i = 0; i < valueTuples.length; i += CHUNK_SIZE) {
        const chunk = valueTuples.slice(i, i + CHUNK_SIZE);
        await bigquery.query({
          query: `
            INSERT INTO \`${projectId}.${DATASET_ID}.${TABLE_ID}\`
            (comparison_id, performance_id, comparison_name, weeks_data, line_color, line_style, is_target,
             comp_date, atp, subs, capacity, occupancy_percent, source, created_at, updated_at)
            VALUES ${chunk.join(',\n')}
          `,
          location: 'US'
        });
      }
    }

    console.log(`Comp import complete: ${stats.imported} imported, ${stats.skipped} skipped`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, stats })
    };

  } catch (error) {
    console.error('Comp import error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
