# PDF Performance Sales Report - Parsing Rules

## Report Column Mapping (Based on Screenshot)

```
Perf Code | Date | Budget | Fixed Pkgs | Non Fixed Pkgs | Single | Subtotal | Reserved | Total | Avail | % Cap
```

### Example Row:
```
251010E | 10/10/2025 8:00 PM | 51.1% | 443 $30,329.00 | 87 $1,209.00 | 620 $31,156.00 | $62,663.60 | 0 $0.00 | $62,663.60 | 380 | 64.0%
```

---

## ✅ CORRECT Color/Column Assignments

### **Yellow Highlight = SUBSCRIPTIONS (Fixed + Non-Fixed)**
- **Fixed Pkgs** (Yellow in report)
  - Count: `443`
  - Revenue: `$30,329.00`
- **Non-Fixed Pkgs** (Yellow in report)
  - Count: `87`
  - Revenue: `$1,209.00`

**Total Subscriptions** = Fixed Count + Non-Fixed Count = `530`

---

### **Green Highlight = SINGLE TICKETS**
- **Single** (Green in report)
  - Count: `620`
  - Revenue: `$31,156.00`

---

## 📊 Key Parsing Rules

### **1. Subscription vs Single Ticket Assignment**

```javascript
// CORRECT (based on your clarification):
subscription_tickets_sold = fixedPkgCount + nonFixedPkgCount  // Yellow columns
single_tickets_sold = singleCount                              // Green column

// WRONG (what we might intuitively think):
// Don't confuse "Fixed" with "Subscriptions" - they're both subscriptions!
```

### **2. Capacity - FIXED VALUE (Not Calculated)**

**❌ DO NOT calculate capacity like this:**
```javascript
// WRONG:
capacity = fixedCount + nonFixedCount + singleCount + reservedCount + availCount
```

**✅ Capacity comes from our database:**
```javascript
// CORRECT:
// Capacity is stored in performances.capacity column
// It's manually assigned per performance, not derived from the report
// Available from Column AG in "Performances by Week" worksheet
```

**Why?** The report's available seats fluctuate based on holds, comps, and temporary blocks. True venue capacity is fixed.

---

### **3. Budget Goal - FIXED VALUE (Not Calculated)**

**❌ DO NOT calculate budget goal like this:**
```javascript
// WRONG:
budget_goal = total_revenue / (budget_percent / 100)
```

**✅ Budget goal comes from our database:**
```javascript
// CORRECT:
// Budget goal is stored in performances.budget_goal column
// It's manually assigned per performance
// Available from Column M in "Performances by Week" worksheet
```

---

### **4. Occupancy Calculation**

**Based on FIXED capacity (from database), not report:**
```javascript
// CORRECT:
occupancy_percent = (total_tickets_sold / capacity) * 100

// Where:
total_tickets_sold = subscription_tickets_sold + single_tickets_sold
capacity = performances.capacity  // From database, NOT from report
```

---

## 📈 Expected Behavior Over Time

### **Single Tickets (Green) - Increases**
- **Normal**: Steady increase as performance approaches
- **Occasional decreases**: Due to cancellations/refunds (usually small)

```
Week 10: 100 tickets
Week 8:  250 tickets  ↑
Week 6:  450 tickets  ↑
Week 4:  620 tickets  ↑
Week 2:  650 tickets  ↑ (small increase, approaching capacity)
```

---

### **Subscription Tickets (Yellow) - Decreases**
- **Start high**: Subscribers lock in their seats early
- **Decreases over time**: Subscribers exchange tickets to other performances
- **Accelerates near performance**: Heavy exchange activity in final days

```
Week 10: 600 tickets
Week 8:  580 tickets  ↓ (small decrease - exchanges starting)
Week 6:  550 tickets  ↓ (moderate decrease)
Week 4:  520 tickets  ↓ (accelerating)
Week 2:  480 tickets  ↓↓ (rapid exchanges in final days)
Day 1:   430 tickets  ↓↓↓ (sometimes dozens per day)
```

**Why?** Subscribers can exchange their tickets for different performances if their plans change. This is normal and expected behavior.

---

## 🔧 Implementation Checklist

### **When Parsing PDF:**

- [x] **Fixed Pkgs** (#, $) → Add to `subscription_tickets_sold`
- [x] **Non-Fixed Pkgs** (#, $) → Add to `subscription_tickets_sold`
- [x] **Single** (#, $) → Set as `single_tickets_sold`
- [x] **Total Revenue** ($) → Set as `total_revenue`
- [x] **Budget %** → Set as `budget_percent` (from report)
- [ ] **Capacity** → **DO NOT** calculate from report, use database value
- [ ] **Budget Goal** → **DO NOT** calculate from report, use database value
- [x] **% Cap** (from report) → Can validate our calculation, but don't rely on it

### **When Storing Data:**

```javascript
// Snapshot data (from PDF):
{
  performance_code: '251010E',
  single_tickets_sold: 620,           // Green column
  subscription_tickets_sold: 530,     // Yellow columns (443 + 87)
  total_tickets_sold: 1150,           // Calculated (620 + 530)
  total_revenue: 62663.60,            // Total column
  budget_percent: 51.1,               // Budget % column
  capacity_percent: 64.0              // % Cap column (from report)
}

// Metadata (from database, NOT from PDF):
{
  capacity: 1440,                     // From performances.capacity (fixed)
  budget_goal: 150000,                // From performances.budget_goal (fixed)
  occupancy_goal: 85                  // From performances.occupancy_goal (fixed)
}
```

---

## 🎯 Data Validation

### **Sanity Checks:**

1. **Subscription trend check:**
   - If subscriptions **increase** significantly → ⚠️ Flag for review
   - Small increases OK (late subscription purchases)
   - Large increases → Likely data error

2. **Single ticket trend check:**
   - If single tickets **decrease** significantly → ⚠️ Flag for review
   - Small decreases OK (refunds/cancellations)
   - Large decreases → Investigate

3. **Capacity validation:**
   - `total_tickets_sold` should never exceed `capacity`
   - If it does → Either capacity is wrong OR data parsing error

4. **Revenue validation:**
   - Revenue should generally increase (as tickets sell)
   - If revenue decreases → Check for refunds or data issues

---

## 📋 Column Reference

Based on your screenshot, the report columns are:

| Column | Field | Color | Goes To | Notes |
|--------|-------|-------|---------|-------|
| 1 | Perf Code | - | `performance_code` | Primary key |
| 2 | Date | - | `performance_date` | Parse carefully |
| 3 | Budget | - | `budget_percent` | From report |
| 4 | Fixed Pkgs (#) | **Yellow** | `subscription_tickets_sold` | Add to subscriptions |
| 5 | Fixed Pkgs ($) | **Yellow** | - | Revenue component |
| 6 | Non Fixed Pkgs (#) | **Yellow** | `subscription_tickets_sold` | Add to subscriptions |
| 7 | Non Fixed Pkgs ($) | **Yellow** | - | Revenue component |
| 8 | Single (#) | **Green** | `single_tickets_sold` | Single tickets |
| 9 | Single ($) | **Green** | - | Revenue component |
| 10 | Subtotal | - | - | Intermediate total |
| 11 | Reserved (#) | - | - | Usually 0 |
| 12 | Reserved ($) | - | - | Usually $0 |
| 13 | Total | - | `total_revenue` | Final revenue |
| 14 | Avail | - | - | **DO NOT USE** for capacity |
| 15 | % Cap | - | `capacity_percent` | Can validate, but recalculate |

---

## 🚨 Common Mistakes to Avoid

1. ❌ **Don't calculate capacity from report** → Use database value
2. ❌ **Don't calculate budget goal from report** → Use database value
3. ❌ **Don't assign Fixed Pkgs to single tickets** → They're subscriptions (yellow)
4. ❌ **Don't assign Single to subscriptions** → They're single tickets (green)
5. ❌ **Don't trust "Avail" for capacity** → It changes based on holds/blocks
6. ❌ **Don't ignore subscription decreases** → It's normal behavior!

---

## 📝 Notes for Dashboard Display

### **Remove from table (per your request):**
- ❌ "vs Target Occ" column (remove for now)

### **Keep these:**
- ✅ Capacity (from database)
- ✅ Budget Goal (from database)
- ✅ Actual vs Budget % (calculated)
- ✅ Occupancy % (calculated from database capacity)

---

**Last Updated**: October 21, 2025
**Source**: Performance Sales Summary PDF + Weekly Sales Report
