// Studio Plans API
// CRUD for studio plans, comps, and marketing activities

const { BigQuery } = require('@google-cloud/bigquery');
const { v4: uuidv4 } = require('uuid');

const initializeBigQuery = () => {
  try {
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
      credentials: { client_email: credentials.client_email, private_key: credentials.private_key },
      location: 'US'
    });
  } catch (error) {
    console.error('BigQuery initialization error:', error.message);
    throw error;
  }
};

const DATASET_ID = process.env.BIGQUERY_DATASET || 'symphony_dashboard';
const PROJECT_ID = () => process.env.GOOGLE_CLOUD_PROJECT_ID;
const table = (name) => `\`${PROJECT_ID()}.${DATASET_ID}.${name}\``;

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json'
};

const respond = (statusCode, body) => ({ statusCode, headers, body: JSON.stringify(body) });

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const bigquery = initializeBigQuery();
    const params = event.queryStringParameters || {};
    const action = params.action;
    const body = event.body ? JSON.parse(event.body) : {};

    switch (action) {
      // ── Plans ──
      case 'get-plans':
        return await getPlans(bigquery, params);
      case 'get-plan':
        return await getPlan(bigquery, params.planId);
      case 'create-plan':
        return await createPlan(bigquery, body);
      case 'update-plan':
        return await updatePlan(bigquery, params.planId, body);
      case 'delete-plan':
        return await deletePlan(bigquery, params.planId);

      // ── Comps ──
      case 'get-plan-comps':
        return await getPlanComps(bigquery, params.planId);
      case 'add-plan-comp':
        return await addPlanComp(bigquery, body);
      case 'remove-plan-comp':
        return await removePlanComp(bigquery, params.compId);
      case 'set-target-comp':
        return await setTargetComp(bigquery, params.planId, params.compId);

      // ── Activities ──
      case 'get-plan-activities':
        return await getPlanActivities(bigquery, params.planId);
      case 'add-activity':
        return await addActivity(bigquery, body);
      case 'update-activity':
        return await updateActivity(bigquery, params.activityId, body);
      case 'delete-activity':
        return await deleteActivity(bigquery, params.activityId);

      // ── Templates ──
      case 'get-templates':
        return await getTemplates(bigquery);
      case 'apply-template':
        return await applyTemplate(bigquery, params.planId, params.templateId);
      case 'save-as-template':
        return await saveAsTemplate(bigquery, body);

      default:
        return respond(400, { error: `Unknown action: ${action}` });
    }
  } catch (error) {
    console.error('Studio API error:', error);
    return respond(500, { error: 'Internal server error', message: error.message });
  }
};

// ═══════════════════════════════════════════
// Plans
// ═══════════════════════════════════════════

async function getPlans(bigquery, params) {
  const includeTemplates = params.includeTemplates === 'true';
  const whereClause = includeTemplates ? '' : 'WHERE is_template = FALSE';

  const [rows] = await bigquery.query({
    query: `SELECT * FROM ${table('studio_plans')} ${whereClause} ORDER BY updated_at DESC`,
    location: 'US'
  });

  return respond(200, rows);
}

async function getPlan(bigquery, planId) {
  if (!planId) return respond(400, { error: 'planId required' });

  const [rows] = await bigquery.query({
    query: `SELECT * FROM ${table('studio_plans')} WHERE plan_id = ?`,
    params: [planId],
    location: 'US'
  });

  if (rows.length === 0) return respond(404, { error: 'Plan not found' });

  // Fetch comps and activities in parallel
  const [comps, activities] = await Promise.all([
    bigquery.query({
      query: `SELECT c.*, p.title as perf_title, p.series as perf_series, p.venue as perf_venue,
                     p.capacity as perf_capacity, p.season as perf_season
              FROM ${table('studio_plan_comps')} c
              LEFT JOIN ${table('performances')} p ON c.performance_code = p.performance_code
              ORDER BY c.is_target DESC, c.sort_order ASC`,
      params: [],
      location: 'US'
    }),
    bigquery.query({
      query: `SELECT * FROM ${table('studio_plan_activities')} WHERE plan_id = ? ORDER BY week_number DESC, sort_order ASC`,
      params: [planId],
      location: 'US'
    })
  ]);

  // Filter comps for this plan (JOIN doesn't support parameterized WHERE easily with LEFT JOIN)
  const planComps = comps[0].filter(c => c.plan_id === planId);

  return respond(200, {
    ...rows[0],
    comps: planComps,
    activities: activities[0]
  });
}

async function createPlan(bigquery, data) {
  const { planName, series, venue, capacity, budgetGoal, isTemplate, targetPerfCode } = data;
  if (!planName) return respond(400, { error: 'planName required' });

  const planId = uuidv4();
  const now = new Date().toISOString();

  await bigquery.query({
    query: `INSERT INTO ${table('studio_plans')}
            (plan_id, plan_name, target_perf_code, series, venue, capacity, budget_goal, is_template, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, TIMESTAMP(?), TIMESTAMP(?))`,
    params: [planId, planName, targetPerfCode || null, series || null, venue || null, capacity || null, budgetGoal || null, isTemplate || false, now, now],
    types: ['STRING', 'STRING', 'STRING', 'STRING', 'STRING', 'INT64', 'FLOAT64', 'BOOL', 'STRING', 'STRING'],
    location: 'US'
  });

  return respond(201, { planId, planName, targetPerfCode, series, venue, capacity, budgetGoal, isTemplate: isTemplate || false, createdAt: now });
}

async function updatePlan(bigquery, planId, data) {
  if (!planId) return respond(400, { error: 'planId required' });

  const updates = [];
  const params = [];
  const types = [];
  const fields = {
    plan_name: { key: 'planName', type: 'STRING' }, series: { key: 'series', type: 'STRING' }, venue: { key: 'venue', type: 'STRING' },
    capacity: { key: 'capacity', type: 'INT64' }, budget_goal: { key: 'budgetGoal', type: 'FLOAT64' },
    is_template: { key: 'isTemplate', type: 'BOOL' }, target_perf_code: { key: 'targetPerfCode', type: 'STRING' }
  };

  for (const [col, { key, type }] of Object.entries(fields)) {
    if (data[key] !== undefined) {
      updates.push(`${col} = ?`);
      params.push(data[key]);
      types.push(type);
    }
  }

  if (updates.length === 0) return respond(400, { error: 'No fields to update' });

  updates.push('updated_at = CURRENT_TIMESTAMP()');
  params.push(planId);
  types.push('STRING');

  await bigquery.query({
    query: `UPDATE ${table('studio_plans')} SET ${updates.join(', ')} WHERE plan_id = ?`,
    params,
    types,
    location: 'US'
  });

  return respond(200, { success: true, planId });
}

async function deletePlan(bigquery, planId) {
  if (!planId) return respond(400, { error: 'planId required' });

  // Delete plan, comps, and activities
  await Promise.all([
    bigquery.query({ query: `DELETE FROM ${table('studio_plans')} WHERE plan_id = ?`, params: [planId], location: 'US' }),
    bigquery.query({ query: `DELETE FROM ${table('studio_plan_comps')} WHERE plan_id = ?`, params: [planId], location: 'US' }),
    bigquery.query({ query: `DELETE FROM ${table('studio_plan_activities')} WHERE plan_id = ?`, params: [planId], location: 'US' })
  ]);

  return respond(200, { success: true, planId });
}

// ═══════════════════════════════════════════
// Comps
// ═══════════════════════════════════════════

async function getPlanComps(bigquery, planId) {
  if (!planId) return respond(400, { error: 'planId required' });

  const [rows] = await bigquery.query({
    query: `SELECT c.*, p.title as perf_title, p.series as perf_series, p.venue as perf_venue,
                   p.capacity as perf_capacity, p.season as perf_season
            FROM ${table('studio_plan_comps')} c
            LEFT JOIN ${table('performances')} p ON c.performance_code = p.performance_code
            WHERE c.plan_id = ?
            ORDER BY c.is_target DESC, c.sort_order ASC`,
    params: [planId],
    location: 'US'
  });

  return respond(200, rows);
}

async function addPlanComp(bigquery, data) {
  const { planId, performanceCode, isTarget } = data;
  if (!planId || !performanceCode) return respond(400, { error: 'planId and performanceCode required' });

  const id = uuidv4();

  // If setting as target, unset existing target (parallel with insert)
  const queries = [];
  if (isTarget) {
    queries.push(bigquery.query({
      query: `UPDATE ${table('studio_plan_comps')} SET is_target = FALSE WHERE plan_id = ? AND is_target = TRUE`,
      params: [planId],
      location: 'US'
    }));
  }

  // Insert -- use created_at for ordering instead of a separate COUNT query
  queries.push(bigquery.query({
    query: `INSERT INTO ${table('studio_plan_comps')} (id, plan_id, performance_code, is_target, sort_order, created_at)
            VALUES (?, ?, ?, ?, 0, CURRENT_TIMESTAMP())`,
    params: [id, planId, performanceCode, isTarget || false],
    location: 'US'
  }));

  await Promise.all(queries);

  return respond(201, { id, planId, performanceCode, isTarget: isTarget || false });
}

async function removePlanComp(bigquery, compId) {
  if (!compId) return respond(400, { error: 'compId required' });

  await bigquery.query({
    query: `DELETE FROM ${table('studio_plan_comps')} WHERE id = ?`,
    params: [compId],
    location: 'US'
  });

  return respond(200, { success: true });
}

async function setTargetComp(bigquery, planId, compId) {
  if (!planId || !compId) return respond(400, { error: 'planId and compId required' });

  // Unset all targets for this plan, then set the new one
  await bigquery.query({
    query: `UPDATE ${table('studio_plan_comps')} SET is_target = FALSE WHERE plan_id = ?`,
    params: [planId],
    location: 'US'
  });

  await bigquery.query({
    query: `UPDATE ${table('studio_plan_comps')} SET is_target = TRUE WHERE id = ? AND plan_id = ?`,
    params: [compId, planId],
    location: 'US'
  });

  return respond(200, { success: true });
}

// ═══════════════════════════════════════════
// Activities
// ═══════════════════════════════════════════

async function getPlanActivities(bigquery, planId) {
  if (!planId) return respond(400, { error: 'planId required' });

  const [rows] = await bigquery.query({
    query: `SELECT * FROM ${table('studio_plan_activities')} WHERE plan_id = ? ORDER BY week_number DESC, sort_order ASC`,
    params: [planId],
    location: 'US'
  });

  return respond(200, rows);
}

async function addActivity(bigquery, data) {
  const { planId, weekNumber, endWeek, label, activityType, color, ticketDelta, spreadWeeks } = data;
  if (!planId || weekNumber === undefined || !label) return respond(400, { error: 'planId, weekNumber, and label required' });

  const activityId = uuidv4();
  const type = activityType || 'Other';
  const safeEndWeek = endWeek != null ? endWeek : null;
  const safeDelta = ticketDelta != null ? ticketDelta : null;
  const safeSpread = spreadWeeks != null ? spreadWeeks : null;

  // Default colors by first tag
  const defaultColors = { email: '#3498db', social: '#e74c3c', groups: '#f39c12', radio: '#9b59b6', pr: '#1abc9c', event: '#e84393', sale: '#00b894', note: '#636e72', other: '#95a5a6' };
  const firstTag = type.split(',')[0].trim().toLowerCase();
  const finalColor = color || defaultColors[firstTag] || '#95a5a6';

  await bigquery.query({
    query: `INSERT INTO ${table('studio_plan_activities')}
            (activity_id, plan_id, week_number, end_week, label, activity_type, color, ticket_delta, spread_weeks, sort_order, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP())`,
    params: [activityId, planId, weekNumber, safeEndWeek, label, type, finalColor, safeDelta, safeSpread],
    types: ['STRING', 'STRING', 'INT64', 'INT64', 'STRING', 'STRING', 'STRING', 'INT64', 'INT64'],
    location: 'US'
  });

  return respond(201, { activityId, planId, weekNumber, endWeek: safeEndWeek, label, activityType: type, color: finalColor, ticketDelta: safeDelta, spreadWeeks: safeSpread });
}

async function updateActivity(bigquery, activityId, data) {
  if (!activityId) return respond(400, { error: 'activityId required' });

  const updates = [];
  const params = [];
  const types = [];
  const fields = {
    week_number: { key: 'weekNumber', type: 'INT64' }, end_week: { key: 'endWeek', type: 'INT64' },
    label: { key: 'label', type: 'STRING' }, activity_type: { key: 'activityType', type: 'STRING' },
    color: { key: 'color', type: 'STRING' }, ticket_delta: { key: 'ticketDelta', type: 'INT64' },
    spread_weeks: { key: 'spreadWeeks', type: 'INT64' }, sort_order: { key: 'sortOrder', type: 'INT64' }
  };

  for (const [col, { key, type }] of Object.entries(fields)) {
    if (data[key] !== undefined) {
      updates.push(`${col} = ?`);
      params.push(data[key]);
      types.push(type);
    }
  }

  if (updates.length === 0) return respond(400, { error: 'No fields to update' });

  updates.push('updated_at = CURRENT_TIMESTAMP()');
  params.push(activityId);
  types.push('STRING');

  await bigquery.query({
    query: `UPDATE ${table('studio_plan_activities')} SET ${updates.join(', ')} WHERE activity_id = ?`,
    params,
    types,
    location: 'US'
  });

  return respond(200, { success: true, activityId });
}

async function deleteActivity(bigquery, activityId) {
  if (!activityId) return respond(400, { error: 'activityId required' });

  await bigquery.query({
    query: `DELETE FROM ${table('studio_plan_activities')} WHERE activity_id = ?`,
    params: [activityId],
    location: 'US'
  });

  return respond(200, { success: true });
}

// ═══════════════════════════════════════════
// Templates
// ═══════════════════════════════════════════

async function getTemplates(bigquery) {
  const [rows] = await bigquery.query({
    query: `SELECT p.*, COUNT(a.activity_id) as activity_count
            FROM ${table('studio_plans')} p
            LEFT JOIN ${table('studio_plan_activities')} a ON p.plan_id = a.plan_id
            WHERE p.is_template = TRUE
            GROUP BY p.plan_id, p.plan_name, p.target_perf_code, p.series, p.venue, p.capacity, p.budget_goal, p.is_template, p.created_at, p.updated_at
            ORDER BY p.updated_at DESC`,
    location: 'US'
  });

  return respond(200, rows);
}

async function applyTemplate(bigquery, planId, templateId) {
  if (!planId || !templateId) return respond(400, { error: 'planId and templateId required' });

  // Get template activities
  const [activities] = await bigquery.query({
    query: `SELECT * FROM ${table('studio_plan_activities')} WHERE plan_id = ? ORDER BY sort_order ASC`,
    params: [templateId],
    location: 'US'
  });

  if (activities.length === 0) return respond(200, { success: true, copied: 0 });

  // Use DML INSERT (not streaming insert) so rows can be deleted immediately
  const tuples = [];
  const params = [];
  const types = [];
  activities.forEach((a, i) => {
    tuples.push('(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP())');
    params.push(uuidv4(), planId, a.week_number, a.end_week || null, a.label, a.activity_type, a.color, a.ticket_delta || null, a.spread_weeks || null, i);
    types.push('STRING', 'STRING', 'INT64', 'INT64', 'STRING', 'STRING', 'STRING', 'INT64', 'INT64', 'INT64');
  });

  await bigquery.query({
    query: `INSERT INTO ${table('studio_plan_activities')}
            (activity_id, plan_id, week_number, end_week, label, activity_type, color, ticket_delta, spread_weeks, sort_order, created_at, updated_at)
            VALUES ${tuples.join(', ')}`,
    params,
    types,
    location: 'US'
  });

  return respond(200, { success: true, copied: activities.length });
}

async function saveAsTemplate(bigquery, data) {
  const { sourcePlanId, templateName } = data;
  if (!sourcePlanId || !templateName) return respond(400, { error: 'sourcePlanId and templateName required' });

  // Get source plan metadata
  const [plans] = await bigquery.query({
    query: `SELECT * FROM ${table('studio_plans')} WHERE plan_id = ?`,
    params: [sourcePlanId],
    location: 'US'
  });
  if (plans.length === 0) return respond(404, { error: 'Source plan not found' });
  const source = plans[0];

  // Create template plan
  const planId = uuidv4();
  const now = new Date().toISOString();
  await bigquery.query({
    query: `INSERT INTO ${table('studio_plans')}
            (plan_id, plan_name, target_perf_code, series, venue, capacity, budget_goal, is_template, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, TRUE, TIMESTAMP(?), TIMESTAMP(?))`,
    params: [planId, templateName, null, source.series || null, source.venue || null, source.capacity || null, source.budget_goal || null, now, now],
    types: ['STRING', 'STRING', 'STRING', 'STRING', 'STRING', 'INT64', 'FLOAT64', 'STRING', 'STRING'],
    location: 'US'
  });

  // Copy activities from source plan
  const [activities] = await bigquery.query({
    query: `SELECT * FROM ${table('studio_plan_activities')} WHERE plan_id = ? ORDER BY sort_order ASC`,
    params: [sourcePlanId],
    location: 'US'
  });

  let activityCount = 0;
  if (activities.length > 0) {
    // Use DML INSERT (not streaming insert) so rows can be deleted immediately
    const tuples = [];
    const actParams = [];
    const actTypes = [];
    activities.forEach((a, i) => {
      tuples.push('(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP())');
      actParams.push(uuidv4(), planId, a.week_number, a.end_week || null, a.label, a.activity_type, a.color, a.ticket_delta || null, a.spread_weeks || null, i);
      actTypes.push('STRING', 'STRING', 'INT64', 'INT64', 'STRING', 'STRING', 'STRING', 'INT64', 'INT64', 'INT64');
    });

    await bigquery.query({
      query: `INSERT INTO ${table('studio_plan_activities')}
              (activity_id, plan_id, week_number, end_week, label, activity_type, color, ticket_delta, spread_weeks, sort_order, created_at, updated_at)
              VALUES ${tuples.join(', ')}`,
      params: actParams,
      types: actTypes,
      location: 'US'
    });
    activityCount = activities.length;
  }

  return respond(201, { planId, planName: templateName, activityCount });
}
