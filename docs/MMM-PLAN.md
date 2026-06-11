# Marketing Mix Model — Plan

**Status:** Draft — ready for further thought
**Last updated:** 2026-04-09
**Owner:** Jim

---

## Goal

Build a model that answers: **"If I send an EMAIL on week 6 before this performance, how many extra tickets does it sell, with what uncertainty?"**

The output is a coefficient table — per channel, per series — that:

1. Powers the projection line in Studio (drag an annotation, fan chart shifts)
2. Replaces the manual `ticket_delta` / `spread_weeks` slider with a learned default
3. Becomes its own dashboard view ("Channel Effectiveness")
4. Gets retrained on a schedule as new annotations and snapshots land

---

## Open question that changes everything

**Annotation backfill goes to "January 1" — which year?**

- **2026-01-01** (~3 months, ~30-50 active performances, ~240 weekly observations): v0 BQML model is defensible for the strongest channels (EMAIL, SOCIAL). Per-series breakdowns are not. Frame as preliminary directional tool.
- **2025-01-01** (~15 months, two seasons, ~120-150 performances, ~1000+ weekly observations): real model. Per-series estimates honest. Adstock can be learned. Studio integration with confidence.

This is the difference between "interesting prototype" and "decision tool."

---

## Model spec

### Unit of analysis: performance × week-out

- Each row = one performance at one week before its date
- Columns = sales that week + activity counts that week + controls
- Why weekly (not daily): smoother, matches Studio's chart resolution, avoids day-of-week noise

### Outcome variable: `weekly_tickets_sold[i, t]`

New tickets sold in week `t` for performance `i`. **Not cumulative** — cumulative creates autocorrelation that breaks standard regression. Could alternatively use velocity as % of remaining capacity.

### Treatment representation: adstocked activity

For each annotation channel `c` (EMAIL, SOCIAL, GROUPS, RADIO, PR, EVENT, SALE), build:

```
adstock_c[i, t] = activity_c[i, t] + λ_c * adstock_c[i, t-1]
```

`λ_c` is the channel decay rate. An email blast doesn't only affect the day it lands — it affects sales for days/weeks after. Adstock captures that carryover.

Sensible priors:

| Channel | Prior on λ | Implied half-life |
|---|---|---|
| EMAIL | Beta(2, 5) → ~0.25 | ~3-5 days |
| SOCIAL | Beta(2, 3) → ~0.4 | ~7 days |
| RADIO | Beta(1, 3) → ~0.2 | ~3 days |
| PR | Beta(2, 2) → ~0.5 | ~10 days |
| GROUPS | (no decay — discrete bookings) | — |
| EVENT | Beta(2, 3) → ~0.4 | ~7 days |
| SALE | Beta(3, 3) → ~0.5 | ~10 days |

In v0 we **fix** these. In v1 we **learn** them.

Saturation transforms (Hill / log) — standard in MMM, **skip in v1**. Symphony has so few activities per show that diminishing-returns curves can't be identified.

### The model

**v0 (BQML linear, fast):**

```
weekly_tickets[i,t] = α + β_base * baseline[i,t]
                       + Σ_c β_c * adstock_c[i,t]
                       + γ_pace * pacing_residual[i, t-1]
                       + series_FE + week_out_FE
                       + ε
```

**v1 (PyMC hierarchical Bayesian):**

```
weekly_tickets[i,t] ~ Normal(μ[i,t], σ)
μ[i,t] = baseline[i,t] + Σ_c β_{c,s(i)} * adstock_c[i,t] + γ * pacing_residual[i,t-1]

# Partial pooling across series
β_{c,s} ~ Normal(μ_c, τ_c)         # series-level effect for channel c
μ_c    ~ Normal(0, 50)              # global channel effect
τ_c    ~ HalfNormal(20)             # how much variation across series
λ_c    ~ Beta(prior above)          # learned adstock decay
```

The hierarchy is non-negotiable given the sample size. Without partial pooling, per-(channel × series) cells have 5-15 observations and the estimates are noise. With pooling, Classical and Pops each get their own coefficient but borrow strength from the global mean.

---

## The selection-bias problem (most important section)

Marketing isn't random. **Emails go out when shows are underselling.** Naive correlation will make EMAIL look *negative* — performances that got emails sold worse than those that didn't, because the bad ones got the emails.

This is the single biggest threat to validity. Three mitigations, layered:

### 1. Control for pre-treatment trajectory
Include `pacing_residual[i, t-1]` as a regressor — how far the show was running ahead/behind its baseline curve at the *prior* week. This conditions on the very state that triggers the marketing decision. If marketing always emails when pacing < -10%, then `pacing_residual` absorbs the selection signal and the residual variation in `EMAIL` becomes closer to random.

### 2. Within-show variation
A show that gets multiple emails at different week-outs is its own control. Performance-level random intercepts (or fixed effects) soak up everything time-invariant about that show — venue, repertoire, conductor, day-of-week. We're then estimating "extra week-of-email tickets *within* the same show," which is much cleaner causally.

### 3. Propensity model (v2 if needed)
Model `P(EMAIL on week t | state at t-1)`, then weight observations by inverse propensity. Standard causal inference move. Only worth doing once the simpler approaches are running and we suspect residual bias.

**Reporting honesty:** v0 should explicitly label coefficients as "associations adjusted for pacing" not "causal lift." Only after validation do we promote to causal claims.

---

## Validation strategy

1. **Time-based holdout** — train on Jan-Feb, predict March. Holding out random rows leaks information across performances; chronological split is honest.
2. **Posterior predictive checks (v1)** — simulate sales curves from the fitted model and overlay on real ones. They should look plausible.
3. **Sign + magnitude sanity** — every channel should have a positive or near-zero point estimate. A strongly negative coefficient means the model is being fooled by selection.
4. **LOO-CV** — Bayesian leave-one-out, compare model variants (with/without adstock, hierarchical vs flat).
5. **Stability check** — refit on rolling windows. Coefficients shouldn't whiplash week-to-week.

---

## Implementation stack

### v0 — BigQuery ML, all-SQL
- Materialize weekly observations table via SQL
- Compute adstock with a window function (4 fixed λ values per channel as separate features — let regression pick the best)
- `CREATE MODEL ... OPTIONS(model_type='LINEAR_REG')`
- Coefficients drop straight into a results table
- **Pros:** stays in your stack, runs in Netlify Functions or scheduled BQ job, ships in days
- **Cons:** no adstock learning, no Bayesian intervals, no hierarchy

### v1 — Python + PyMC, separate batch job
- Reads from BQ, fits hierarchical model, writes coefficients + traces back to BQ
- Scheduled weekly (or on-demand from Studio admin)
- Could run as a Cloud Run job triggered by Cloud Scheduler — same GCP project as the existing `cloud-functions/`
- **Pros:** real uncertainty intervals, learned adstock, hierarchy
- **Cons:** new runtime, ~1 week to set up, dependency on Python service

Ship v0 first to validate the data shape, then move to v1.

---

## Data prep checklist

Must exist before any model fits:

- [ ] Annotation backfill complete to Jan 1 (in progress)
- [ ] Audit annotation type values — any typos, deprecated categories, free-text in `type` field?
- [ ] Per-performance baseline curve (the empirical fan chart — hard prerequisite, the MMM regresses *residuals from this baseline*)
- [ ] Weekly observation SQL view: `(performance_id, week_out, weekly_tickets, baseline_weekly, pacing_residual_lag1, activity_count_by_channel)`
- [ ] Series normalization applied (CS01→Classical etc.)
- [ ] Bad data row excluded (260315M / 2025-11-23 swap)
- [ ] Capacity remaining feature (some weeks have ceiling effects)

---

## Phasing

| Phase | Work | Duration | Output |
|---|---|---|---|
| **A. Data foundation** | Backfill audit, SQL feature build, baseline curve model, weekly observation view | 1-2 weeks | BQ view ready, baseline curves visible in Studio |
| **B. BQML v0** | Materialize adstock features, fit linear model, ship coefficient table, diagnostic page | 3-5 days | Per-channel point estimates with caveats |
| **C. PyMC v1** | Hierarchical Bayesian model, learned adstock, posterior predictive checks, scheduled retrain job | 1-2 weeks | Per-channel × series coefficients with 95% intervals |
| **D. Studio integration** | Annotation form shows learned default lift, projection line incorporates effects probabilistically, new "Channel Effectiveness" view | 3-5 days | Studio uses model output live |
| **E. Validation cycle** | Holdout testing, refit cadence, monitor stability, escalate to propensity model if selection bias remains | Ongoing | Trustworthy numbers Adrienne can act on |

Phase A is the hard part. Phases B-D are mechanical once the data view exists.

---

## Key risks, ranked

1. **Sample size** (most likely to bite). If Jan 1 = 2026, per-channel intervals will be wide enough that the model can't make strong claims. Mitigation: hierarchical pooling, ship v0 anyway as directional, gather more data, refit.
2. **Selection bias.** Mitigations baked into the spec above, but residual bias can still mislead. Watch for negative coefficients on channels everyone knows work.
3. **Annotation data quality.** If marketing tags inconsistently (one person logs every email, another doesn't), GIGO. Audit annotation hygiene before fitting.
4. **Cold start in Studio integration.** First version of "automatic lift on annotation drag" will sometimes give weird suggestions. Need a UX fallback ("Use learned default" vs "Set manually").
5. **Overfitting to the current season.** The 25-26 lineup, conductors, and pricing aren't representative of all futures. Hierarchical model with appropriate regularization helps; honest credible intervals more so.

---

## What to do this week vs later

**This week, while annotation backfill finishes:**

- Build the per-performance baseline curve (the empirical fan chart). Prerequisite for MMM *and* delivers immediate value to Studio independently.
- Audit the existing annotation data — types, counts per channel, any data quality landmines.
- Sketch the weekly observation SQL.

**Next, once backfill is done:**

- Phase A → Phase B (BQML v0)
- Look at the v0 coefficients with the marketing team. Even if numbers are noisy, the *conversation* about "EMAIL looks like ~+30 tickets ±20" reshapes how people think about activities.

**After v0 is in front of humans:**

- Phase C only if v0 looks promising and team wants tighter numbers.

---

## Open questions for further thought

- [ ] **Which "January 1"?** 2025 or 2026 — see top of doc.
- [ ] Is per-week the right grain, or should we go daily for richer signal at the cost of noise?
- [ ] Should the baseline curve be empirical (quantile from comps) or parametric (fitted Gompertz/logistic)? Tradeoff: empirical is simpler and assumption-free; parametric extrapolates more cleanly.
- [ ] Does the marketing team log activity *intent* (planned send) or only *execution* (after-the-fact)? Affects causal interpretation.
- [ ] Is there activity *cost* data anywhere? Even rough — would unlock cost-per-incremental-ticket and ROI ranking, which is the question Adrienne probably actually wants answered.
- [ ] Should we model price/discount as a treatment too? SALE annotations imply yes, but raw price changes outside of those may also exist.
- [ ] How do we handle multi-night productions? Aggregate to production level, or model each night separately with a production-level random effect?
- [ ] Is there a clean way to surface "this model doesn't have enough data to say anything useful about RADIO yet" in the UI, instead of pretending precision we don't have?
