# Excel Export - Column Implementation Plan

## Instructions
For each column below, fill in the **YOUR DECISION** field with one of:
- `INCLUDE` - Add this column to the export
- `SKIP` - Don't include this column
- `ESTIMATE` - Include with calculated/estimated data (where noted)
- Custom instruction

---

## Column A: Wk #
**What it is:** Sequential week number
**Can we do it?** ✅ YES - Calculate from index
**YOUR DECISION:**

---

## Column B: # Weeks Until Perf
**What it is:** Number of weeks from today until performance
**Can we do it?** ✅ YES - Calculate: `Math.floor((perfDate - today) / 7)`
**YOUR DECISION:**

---

## Column C: Perf. Week (Mon)
**What it is:** Monday date of the performance week
**Can we do it?** ✅ YES - Calculate Monday from `performance_date`
**YOUR DECISION:**

---

## Column D: Performance
**What it is:** Performance title/name
**Can we do it?** ✅ YES - Direct from `title` field
**YOUR DECISION:**

---

## Columns E-F: (Empty in template)
**What it is:** Blank columns in original template
**Can we do it?** N/A
**YOUR DECISION:**

---

## Column G: Performance Date(s)
**What it is:** Date of performance
**Can we do it?** ✅ YES - From `performance_date`, format as M/D/YYYY
**YOUR DECISION:**

---

## Column H: Performance Type
**What it is:** Series (Classical, Pops, Special Event, etc.)
**Can we do it?** ✅ YES - Direct from `series` field
**YOUR DECISION:**

---

## Column I: Actual Total Tickets Sold
**What it is:** Total tickets sold (singles + subscriptions)
**Can we do it?** ✅ YES - Direct from `total_tickets_sold`
**YOUR DECISION:**

---

## Column J: Projected Single Tickets + Actual Subs
**What it is:** Projection of where single tickets will end up + actual subs
**Can we do it?** ❌ NO - No projection model in BigQuery
**YOUR DECISION:**

---

## Column K: Projected Total OCC at Performance
**What it is:** Projected occupancy percentage at performance time
**Can we do it?** ❌ NO - No projection data available
**YOUR DECISION:**

---

## Column L: Total Actual Revenue
**What it is:** Total revenue from all ticket sales
**Can we do it?** ✅ YES - Direct from `total_revenue`, format as currency
**YOUR DECISION:**

---

## Column M: TOTAL BUDGET
**What it is:** Revenue budget/goal for this performance
**Can we do it?** ✅ YES - Direct from `budget_goal`, format as currency
**YOUR DECISION:**

---

## Column N: Actual/Budget %
**What it is:** Percentage of budget achieved
**Can we do it?** ✅ YES - Direct from `budget_percent`, format as %
**YOUR DECISION:**

---

## Column O: Projected/Budget %
**What it is:** Projected percentage of budget at performance time
**Can we do it?** ❌ NO - No projection data
**YOUR DECISION:**

---

## Column P: Actual Single Tickets Sold
**What it is:** Number of single tickets sold
**Can we do it?** ✅ YES - Direct from `single_tickets_sold`
**YOUR DECISION:**

---

## Column Q: Target Single Tickets for 85% OCC
**What it is:** How many single tickets needed to hit 85% occupancy
**Can we do it?** ✅ YES - Calculate: `capacity * 0.85 - subscription_tickets_sold`
**YOUR DECISION:**

---

## Column R: Projected Single Tickets
**What it is:** Projection of single tickets at performance time
**Can we do it?** ❌ NO - No projection model
**YOUR DECISION:**

---

## Column S: Projected Single Tickets vs 85% OCC Target
**What it is:** Difference between projected singles and 85% target
**Can we do it?** ❌ NO - Depends on Column R projection
**YOUR DECISION:**

---

## Column T: Actual Revenue (Singles)
**What it is:** Revenue from single tickets only
**Can we do it?** ⚠️ ESTIMATE - Could calculate: `(single_tickets_sold / total_tickets_sold) * total_revenue`
**Note:** Assumes revenue splits proportionally to ticket count (may not be accurate)
**YOUR DECISION:**

---

## Column U: BUDGET (Singles)
**What it is:** Budget goal for single ticket revenue
**Can we do it?** ❌ NO - Budget not broken down by ticket type in database
**YOUR DECISION:**

---

## Column V: Actual/Budget % (Singles)
**What it is:** Single ticket revenue vs single ticket budget
**Can we do it?** ❌ NO - Missing singles budget (Column U)
**YOUR DECISION:**

---

## Column W: Projected/Budget % (Singles)
**What it is:** Projected single ticket revenue vs budget
**Can we do it?** ❌ NO - No projection data + missing singles budget
**YOUR DECISION:**

---

## Column X: Actual Sub Tickets Sold
**What it is:** Number of subscription tickets sold
**Can we do it?** ✅ YES - Direct from `subscription_tickets_sold`
**YOUR DECISION:**

---

## Column Y: Actual Revenue (Subscriptions)
**What it is:** Revenue from subscription tickets
**Can we do it?** ⚠️ ESTIMATE - Could calculate: `(subscription_tickets_sold / total_tickets_sold) * total_revenue`
**Note:** Assumes revenue splits proportionally to ticket count (may not be accurate)
**YOUR DECISION:**

---

## Column Z: BUDGET (Subscriptions)
**What it is:** Budget goal for subscription revenue
**Can we do it?** ❌ NO - Budget not broken down by ticket type
**YOUR DECISION:**

---

## Column AA: Actual vs Budget % (Subs)
**What it is:** Subscription revenue vs subscription budget
**Can we do it?** ❌ NO - Missing subs budget (Column Z)
**YOUR DECISION:**

---

## Column AB: Max CAP
**What it is:** Maximum venue capacity
**Can we do it?** ✅ YES - Direct from `capacity` field
**YOUR DECISION:**

---

## Column AC: Actual OCC SOLD
**What it is:** Current occupancy percentage
**Can we do it?** ✅ YES - Direct from `capacity_percent`, format as %
**YOUR DECISION:**

---

## Column AD: Single Ticket ATP
**What it is:** Average ticket price for single tickets
**Can we do it?** ⚠️ ESTIMATE - Calculate: `total_revenue / total_tickets_sold` (approximate)
**Note:** This is average across ALL tickets, not just singles. True singles ATP would need singles revenue breakdown
**YOUR DECISION:**

---

## Column AE: # New HH
**What it is:** Number of new households
**Can we do it?** ❌ NO - Household data not in BigQuery
**YOUR DECISION:**

---

## Column AF: # Ret HH
**What it is:** Number of returning households
**Can we do it?** ❌ NO - Household data not in BigQuery
**YOUR DECISION:**

---

## Column AG: # Total HH
**What it is:** Total number of households
**Can we do it?** ⚠️ ROUGH ESTIMATE - Could estimate: `total_tickets_sold / 2.1` (avg tickets per household)
**Note:** Very rough estimate, accuracy unknown
**YOUR DECISION:**

---

## Column AH: Revenue last week
**What it is:** Revenue from previous week
**Can we do it?** ❌ NO - Would need snapshot comparison logic
**YOUR DECISION:**

---

## Column AI: Increase over week
**What it is:** Revenue increase from last week
**Can we do it?** ❌ NO - Depends on Column AH
**YOUR DECISION:**

---

## Summary Statistics
- **✅ Can do directly:** 18 columns
- **⚠️ Can estimate:** 4 columns (T, Y, AD, AG)
- **❌ Cannot do:** 14 columns
- **Total columns:** 35+

---

## After You Fill This Out
Save this file and let me know when you're done. I'll use your decisions to implement the export feature.
