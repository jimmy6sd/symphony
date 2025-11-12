# ATP Calculation Trace for Performance 251122E

## BigQuery Data (Verified Correct)
```
Latest Snapshot (2025-11-11):
  Single Tickets: 314
  Total Tickets: 879
  Single Revenue: $16,981
  Total Revenue: $55,640.70

  Single ATP (BigQuery): $54.08   ✅ CORRECT (16981 / 314 = 54.08)
  Overall ATP (BigQuery): $63.30  ✅ CORRECT (55640.7 / 879 = 63.30)
  Fixed ATP (BigQuery): $68.48    ✅ CORRECT
  Non-Fixed ATP (BigQuery): $65.90 ✅ CORRECT
```

---

## Code Calculation Points

### 1. **Detail Modal - Single Ticket ATP** (data-table.js line 1019)
```javascript
{
  label: 'Single Ticket ATP',
  value: (performance.single_atp || performance.singleTicketATP) > 0
    ? '$' + (performance.single_atp || performance.singleTicketATP).toFixed(2)
    : 'N/A'
}
```
**Expected**: Should show $54.08
**Issue**: Showing "N/A" because `performance.single_atp` is not in the performance object

---

### 2. **Detail Modal - Blended ATP** (data-table.js line 1020)
```javascript
{
  label: 'Blended ATP',
  value: (performance.overall_atp || performance.overallATP) > 0
    ? '$' + (performance.overall_atp || performance.overallATP).toFixed(2)
    : (totalSold > 0 ? '$' + ((performance.totalRevenue || 0) / totalSold).toFixed(2) : 'N/A')
}
```
**Expected**: Should show $63.30
**Fallback calculation**: `totalRevenue / totalSold` = 55640.70 / 879 = $63.30

---

### 3. **Detail Modal - Comp Blended ATP** (data-table.js line 1021)
```javascript
{
  label: 'Comp Blended ATP',
  value: targetComp?.atp > 0 ? '$' + targetComp.atp.toFixed(2) : 'N/A',
  spacing: 'bottom'
}
```
**Expected**: Should show comp ATP if target comp is set

---

### 4. **Historical Tooltip ATP** (data-table.js lines 1951-1953)
```javascript
// Use single ticket ATP from granular data
const singleTicketATP = d.single_atp || d.singleTicketATP || 0;
const atp = singleTicketATP > 0
  ? singleTicketATP
  : (d.tickets > 0 ? (d.revenue || 0) / d.tickets : 0);
```
**Expected**: Should use `d.single_atp` from snapshot data
**Fallback**: Calculates `revenue / tickets` if single_atp not available

Tooltip displays (line 1971):
```javascript
<span style="color: #27ae60;">●</span> Single Ticket ATP: $${atp.toFixed(2)}<br/>
```

---

### 5. **Sales Curve - Current Sales Tooltip** (sales-curve-chart.js lines 1104-1105)
```javascript
// Use single ticket ATP (from granular data) instead of overall ATP
const singleTicketATP = performance.single_atp || performance.singleTicketATP || 0;
const atp = singleTicketATP > 0
  ? singleTicketATP
  : (totalTickets > 0 ? revenue / totalTickets : 0);
```
**Expected**: Should use `performance.single_atp`
**Fallback**: Calculates `revenue / totalTickets` if single_atp not available

Tooltip displays (line 1126):
```javascript
Single Ticket ATP: $${atp.toFixed(2)}<br/>
```

---

### 6. **Comparison Line Tooltip** (sales-curve-chart.js line 874)
```javascript
if (comparison.atp && comparison.atp > 0) {
    atpLine = `Blended ATP: $${comparison.atp.toFixed(2)}<br/>`;
    const revenue = d.sales * comparison.atp;
    revenueLine = `Revenue: $${revenue.toLocaleString()}<br/>`;
}
```
**Expected**: Shows "Blended ATP" label for comparison lines ✅ CORRECT

---

## Root Cause Analysis

### Issue #1: Single Ticket ATP showing "N/A" in Detail Modal
**Problem**: The `performance` object passed to the detail modal doesn't include `single_atp` field.

**Where to check**:
- `data-table.js` line ~395-400: `getPerformances()` call
- Check what fields are returned from the data service
- The performance object needs to include granular ATP fields

### Issue #2: Tooltip using blended formula
**Problem**: Fallback calculation being used because `performance.single_atp` is not in the object.

**Fix**: Ensure performance data includes all granular ATP fields from BigQuery.

---

## Verification Queries

### Check what fields data service returns:
```javascript
// In browser console:
const perf = await window.dataService.getPerformances();
console.log('Performance fields:', Object.keys(perf.performances[0]));
console.log('Has single_atp?', perf.performances[0].single_atp);
console.log('Has overall_atp?', perf.performances[0].overall_atp);
```

### Check snapshot data structure:
```javascript
// In browser console:
const snapshots = await window.dataService.getPerformanceSnapshots('251122E');
console.log('Snapshot fields:', Object.keys(snapshots[0]));
console.log('Has single_atp?', snapshots[0].single_atp);
```

---

## Expected Data Flow

```
BigQuery snapshots table
  ↓ (has single_atp, overall_atp fields)
  ↓
Netlify Function: get-performances-with-wow
  ↓ (should return all ATP fields)
  ↓
DataService.getPerformances()
  ↓ (performance object should have ATP fields)
  ↓
Detail Modal / Chart Tooltips
  ↓ (should display ATP from performance object)
  ↓
UI Display
```

**Next Step**: Check the Netlify function to ensure it's selecting and returning the ATP fields.
