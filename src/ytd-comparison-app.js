// YTD Comparison App - Initializes and manages the YTD comparison page
import YTDComparisonChart from './charts/ytd-comparison-chart.js';

class YTDComparisonApp {
    constructor() {
        this.chart = null;
        this.data = null;
        this.availableYears = [];
        this.segmentCount = 6;  // Default to 6 segments
        this.attributionMode = 'performance';  // Default to performance date attribution

        this.yearColors = {
            'FY23': '#8884d8',
            'FY24': '#8884d8',  // Purple (was FY23's color)
            'FY25': '#ff7c43',  // Orange (target comp)
            'FY26': '#3498db',  // Blue (current year - merged)
            'FY26 Projected': '#2ecc71'  // Green (projection)
        };

        this.metricLabels = {
            'revenue': 'Total Revenue',
            'tickets': 'Total Tickets',
            'singleRevenue': 'Single Ticket Revenue',
            'singleTickets': 'Single Tickets',
            'subscriptionRevenue': 'Subscription Revenue',
            'subscriptionTickets': 'Subscription Tickets'
        };
    }

    async init() {
        try {
            this.showLoading();
            await this.loadData();
            this.setupControls();
            this.showChart();  // Show container first so chart can measure width
            this.renderChart();
            this.renderSummary();
            this.renderSegmentCards();
        } catch (error) {
            console.error('Error initializing YTD comparison:', error);
            this.showError(error.message);
        }
    }

    async loadData() {
        const weekType = document.getElementById('week-type-select')?.value || 'fiscal';

        // Main chart always uses snapshot mode (revenue by when collected)
        const response = await fetch(`/.netlify/functions/bigquery-snapshots?action=get-ytd-comparison&weekType=${weekType}&attributionMode=snapshot`);

        if (!response.ok) {
            throw new Error(`Failed to load data: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        this.data = result.data;

        // Merge FY26 and FY26 Current into a single FY26 series
        this.mergeFY26Data();

        this.availableYears = Object.keys(this.data).filter(y => !y.includes('Projected') && y !== 'FY23');

        // Also load segment data with current attribution mode
        await this.loadSegmentData();

        console.log('Loaded YTD data:', this.availableYears, 'years');
    }

    async loadSegmentData() {
        const weekType = document.getElementById('week-type-select')?.value || 'fiscal';
        const attributionMode = document.getElementById('segment-attribution-select')?.value || 'snapshot';

        // Load data with selected attribution mode for segments
        const response = await fetch(`/.netlify/functions/bigquery-snapshots?action=get-ytd-comparison&weekType=${weekType}&attributionMode=${attributionMode}`);

        if (!response.ok) {
            throw new Error(`Failed to load segment data: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        this.segmentData = result.data;

        // Merge FY26 data for segments
        this.mergeFY26SegmentData();
    }

    mergeFY26SegmentData() {
        if (!this.segmentData) return;

        const fy26Excel = this.segmentData['FY26'] || [];
        const fy26Current = this.segmentData['FY26 Current'] || [];

        if (fy26Excel.length === 0 && fy26Current.length === 0) return;

        const weekMap = new Map();
        fy26Excel.forEach(week => weekMap.set(week.fiscalWeek, { ...week }));
        fy26Current.forEach(week => weekMap.set(week.fiscalWeek, { ...week }));

        this.segmentData['FY26'] = Array.from(weekMap.values()).sort((a, b) => a.fiscalWeek - b.fiscalWeek);
        delete this.segmentData['FY26 Current'];
    }

    mergeFY26Data() {
        const fy26Excel = this.data['FY26'] || [];
        const fy26Current = this.data['FY26 Current'] || [];

        if (fy26Excel.length === 0 && fy26Current.length === 0) return;

        // Create a map of week -> data, preferring FY26 Current (live) over Excel
        const weekMap = new Map();

        // First add Excel data
        fy26Excel.forEach(week => {
            const key = week.fiscalWeek; // Use fiscal week as key
            weekMap.set(key, { ...week });
        });

        // Then overlay with Current data (overwrites Excel for same weeks)
        fy26Current.forEach(week => {
            const key = week.fiscalWeek;
            weekMap.set(key, { ...week });
        });

        // Convert back to sorted array
        const merged = Array.from(weekMap.values())
            .sort((a, b) => a.fiscalWeek - b.fiscalWeek);

        // Replace FY26 with merged data and remove FY26 Current
        this.data['FY26'] = merged;
        delete this.data['FY26 Current'];

        console.log(`Merged FY26 data: ${fy26Excel.length} Excel + ${fy26Current.length} Current = ${merged.length} weeks`);
    }

    setupControls() {
        // Metric selector (for main chart)
        const metricSelect = document.getElementById('metric-select');
        metricSelect?.addEventListener('change', (e) => {
            this.chart?.setMetric(e.target.value);
            this.renderSummary();
        });

        // Week type selector (for main chart)
        const weekTypeSelect = document.getElementById('week-type-select');
        weekTypeSelect?.addEventListener('change', async (e) => {
            // Reload data with new week type and re-render
            await this.loadData();
            this.chart?.setData(this.data);
            this.chart?.setWeekType(e.target.value);
        });

        // Segment selector
        const segmentBtns = document.querySelectorAll('.segment-btn');
        segmentBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                segmentBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.segmentCount = parseInt(btn.dataset.segments);
                this.renderSegmentCards();
            });
        });

        // Segment-specific metric selector
        const segmentMetricSelect = document.getElementById('segment-metric-select');
        segmentMetricSelect?.addEventListener('change', () => {
            this.renderSegmentCards();
        });

        // Segment-specific week type selector
        const segmentWeekTypeSelect = document.getElementById('segment-week-type-select');
        segmentWeekTypeSelect?.addEventListener('change', () => {
            this.renderSegmentCards();
        });

        // Attribution mode selector (only affects segments, not the main chart)
        const segmentAttributionSelect = document.getElementById('segment-attribution-select');
        segmentAttributionSelect?.addEventListener('change', async (e) => {
            this.attributionMode = e.target.value;
            await this.loadSegmentData();
            this.renderSegmentCards();
        });

        // Year toggles
        this.renderYearToggles();
    }

    renderYearToggles() {
        const container = document.getElementById('year-toggles');
        if (!container) return;

        container.innerHTML = '';

        this.availableYears.forEach(year => {
            const toggle = document.createElement('label');
            toggle.className = 'year-toggle active';
            toggle.dataset.year = year;

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = true;

            const text = document.createTextNode(year);

            toggle.appendChild(checkbox);
            toggle.appendChild(text);

            toggle.addEventListener('click', (e) => {
                e.preventDefault();
                toggle.classList.toggle('active');
                checkbox.checked = !checkbox.checked;
                this.chart?.toggleYear(year);
                this.renderSummary();
                this.renderSegmentCards();
            });

            container.appendChild(toggle);
        });
    }

    renderChart() {
        this.chart = new YTDComparisonChart('ytd-chart-container', {
            metric: document.getElementById('metric-select')?.value || 'revenue',
            weekType: document.getElementById('week-type-select')?.value || 'fiscal'
        });

        this.chart.setData(this.data);
    }

    renderSummary() {
        const container = document.getElementById('ytd-summary');
        if (!container || !this.data) return;

        container.innerHTML = '';
        container.style.display = 'grid';

        const metric = document.getElementById('metric-select')?.value || 'revenue';

        // Get visible years from chart
        const visibleYears = this.chart ? Array.from(this.chart.visibleYears) : this.availableYears;

        visibleYears.sort().forEach(year => {
            const yearData = this.data[year];
            if (!yearData || yearData.length === 0) return;

            // Get latest value for this year
            const latestWeek = yearData.reduce((max, w) => {
                const weekNum = w.fiscalWeek;
                return weekNum > max.week ? { week: weekNum, data: w } : max;
            }, { week: 0, data: null });

            if (!latestWeek.data) return;

            // Get value for the selected metric (field names match metric values directly)
            const value = latestWeek.data[metric] || 0;

            // Format based on whether it's a ticket count or revenue
            const isTicketMetric = metric.toLowerCase().includes('ticket');
            const formattedValue = isTicketMetric
                ? value.toLocaleString()
                : '$' + Math.round(value).toLocaleString();

            const card = document.createElement('div');
            card.className = 'summary-card';

            const isCurrent = year === 'FY26';
            const statusLabel = isCurrent ? 'YTD' : 'FINAL';

            card.style.borderLeft = `4px solid ${this.yearColors[year]}`;
            if (isCurrent) {
                card.style.opacity = '0.7';
            }

            const metricLabel = this.metricLabels[metric] || metric;
            card.innerHTML = `
                <h3>${year} <span style="font-size: 0.7em; font-weight: normal; color: #555;">${statusLabel}</span></h3>
                <div class="value">${formattedValue}</div>
                <div class="subtext" style="color: #555;">Week ${latestWeek.week} · ${metricLabel}</div>
            `;

            container.appendChild(card);
        });
    }

    getSegmentBoundaries(segmentCount) {
        const weeksPerSegment = Math.ceil(52 / segmentCount);
        const segments = [];
        for (let i = 0; i < segmentCount; i++) {
            segments.push({
                index: i + 1,
                start: i * weeksPerSegment + 1,
                end: Math.min((i + 1) * weeksPerSegment, 52)
            });
        }
        return segments;
    }

    // Convert fiscal week to approximate month (fiscal year starts July 1)
    fiscalWeekToMonth(week) {
        // Fiscal week 1 starts July 1
        // ~4.33 weeks per month
        const months = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
        const monthIndex = Math.min(Math.floor((week - 1) / 4.33), 11);
        return months[monthIndex];
    }

    // Get month range string for a segment
    getSegmentMonthRange(startWeek, endWeek) {
        const startMonth = this.fiscalWeekToMonth(startWeek);
        const endMonth = this.fiscalWeekToMonth(endWeek);
        if (startMonth === endMonth) {
            return startMonth;
        }
        return `${startMonth}-${endMonth}`;
    }

    getCurrentWeek(weekType) {
        const today = new Date();

        if (weekType === 'iso') {
            const jan1 = new Date(today.getFullYear(), 0, 1);
            const days = Math.floor((today - jan1) / (24 * 60 * 60 * 1000));
            return Math.ceil((days + jan1.getDay() + 1) / 7);
        } else {
            const year = today.getFullYear();
            const month = today.getMonth();
            const fiscalYearStart = month >= 6
                ? new Date(year, 6, 1)
                : new Date(year - 1, 6, 1);
            const days = Math.floor((today - fiscalYearStart) / (24 * 60 * 60 * 1000));
            return Math.ceil((days + 1) / 7);
        }
    }

    calculateSegmentTotal(yearData, segment, metric, weekType, isCurrent = false, attributionMode = 'snapshot') {
        if (!yearData || yearData.length === 0) return { value: 0, incomplete: true };

        const weekKey = weekType === 'iso' ? 'isoWeek' : 'fiscalWeek';

        // Find all data points within this segment
        const weeksInSegment = yearData.filter(w => {
            const week = w[weekKey];
            return week >= segment.start && week <= segment.end;
        });

        if (weeksInSegment.length === 0) return { value: 0, incomplete: true };

        // Get first and last data points in this segment
        const firstInSegment = weeksInSegment.reduce((min, w) =>
            w[weekKey] < min[weekKey] ? w : min
        , weeksInSegment[0]);
        const lastInSegment = weeksInSegment.reduce((max, w) =>
            w[weekKey] > max[weekKey] ? w : max
        , weeksInSegment[0]);

        const firstWeekInSegment = firstInSegment[weekKey];
        const ytdAtEndOfSegment = lastInSegment[metric] || 0;

        // Find the YTD value at the end of the PREVIOUS segment (to calculate delta)
        const prevWeeks = yearData.filter(w => w[weekKey] < segment.start);
        let ytdAtStartOfSegment = 0;
        if (prevWeeks.length > 0) {
            const lastPrevWeek = prevWeeks.reduce((max, w) =>
                w[weekKey] > max[weekKey] ? w : max
            , prevWeeks[0]);
            ytdAtStartOfSegment = lastPrevWeek[metric] || 0;
        }

        // Segment value = YTD at end of segment - YTD at start of segment
        const segmentValue = ytdAtEndOfSegment - ytdAtStartOfSegment;

        // Check if this is the current segment for the current year (still in progress)
        // Only applies in snapshot mode - in performance mode, future segments show advance sales
        const currentWeek = this.getCurrentWeek(weekType);
        const isCurrentSegment = attributionMode === 'snapshot' && isCurrent && currentWeek >= segment.start && currentWeek <= segment.end;

        // Check if segment is incomplete:
        // - In snapshot mode: missing early weeks OR current segment still in progress
        // - In performance mode: only if there's literally no data (handled above with return)
        //   Missing early weeks is normal (no concerts scheduled those weeks)
        const missingEarlyWeeks = attributionMode === 'snapshot' && firstWeekInSegment > segment.start;
        const incomplete = missingEarlyWeeks || isCurrentSegment;
        return { value: segmentValue, incomplete };
    }

    renderSegmentCards() {
        const container = document.getElementById('segment-cards');
        const wrapper = document.getElementById('segment-comparison');
        // Use segmentData if available (for attribution modes), fallback to main data
        const dataSource = this.segmentData || this.data;
        if (!container || !wrapper || !dataSource) return;

        container.innerHTML = '';
        wrapper.style.display = 'block';

        // Use segment-specific controls if available, fallback to main controls
        const metric = document.getElementById('segment-metric-select')?.value || 'revenue';
        const weekType = document.getElementById('segment-week-type-select')?.value || 'fiscal';
        const segments = this.getSegmentBoundaries(this.segmentCount);

        // Get visible years (exclude projected for segment comparison)
        const visibleYears = this.chart
            ? Array.from(this.chart.visibleYears).filter(y => !y.includes('Projected'))
            : this.availableYears.filter(y => !y.includes('Projected'));

        visibleYears.sort();

        // Calculate totals for each segment and year
        const attributionMode = document.getElementById('segment-attribution-select')?.value || 'snapshot';
        const segmentData = segments.map(segment => {
            const yearResults = {};
            visibleYears.forEach(year => {
                const isCurrent = year === 'FY26'; // FY26 is the current season
                yearResults[year] = this.calculateSegmentTotal(dataSource[year], segment, metric, weekType, isCurrent, attributionMode);
            });
            return { segment, yearResults };
        });

        // Find max value across all segments for consistent bar scaling
        const maxValue = Math.max(...segmentData.flatMap(s =>
            Object.values(s.yearResults).map(r => r.value)
        ));

        // Determine which segment contains the current week
        const currentWeek = this.getCurrentWeek(weekType);

        // Create a card for each segment
        segmentData.forEach(({ segment, yearResults }) => {
            const isCurrentSegment = currentWeek >= segment.start && currentWeek <= segment.end;

            const card = document.createElement('div');
            card.className = 'segment-card' + (isCurrentSegment ? ' current-segment' : '');

            // Header with segment label and current indicator
            const header = document.createElement('div');
            header.className = 'segment-card-header';
            const currentBadge = isCurrentSegment ? `<span class="current-badge">Week ${currentWeek}</span>` : '';
            const monthRange = this.getSegmentMonthRange(segment.start, segment.end);
            header.innerHTML = `<h3>Segment ${segment.index}${currentBadge}</h3><span class="week-range">${monthRange} <span class="week-numbers">(W${segment.start}-W${segment.end})</span></span>`;
            card.appendChild(header);

            // Bar chart and values for each year
            const barsContainer = document.createElement('div');
            barsContainer.className = 'segment-bars';

            visibleYears.forEach((year) => {
                const result = yearResults[year];
                const value = result.value;
                const incomplete = result.incomplete;
                const barWidth = maxValue > 0 ? (value / maxValue) * 100 : 0;
                const color = this.yearColors[year] || '#999';

                // Format based on whether it's a ticket count or revenue
                const isTicketMetric = metric.toLowerCase().includes('ticket');
                const formattedValue = isTicketMetric
                    ? value.toLocaleString()
                    : '$' + Math.round(value).toLocaleString();

                const incompleteIndicator = incomplete ? '<span class="incomplete-indicator" title="Incomplete data">*</span>' : '';

                const row = document.createElement('div');
                row.className = `segment-bar-row${incomplete ? ' incomplete' : ''}`;
                row.innerHTML = `
                    <span class="year-label">${year}</span>
                    <div class="bar-container">
                        <div class="bar" style="width: ${barWidth}%; background-color: ${color};${incomplete ? ' opacity: 0.5;' : ''}"></div>
                    </div>
                    <span class="value">${formattedValue}${incompleteIndicator}</span>
                `;
                barsContainer.appendChild(row);
            });

            card.appendChild(barsContainer);
            container.appendChild(card);
        });
    }

    showLoading() {
        document.getElementById('loading-indicator').style.display = 'flex';
        document.getElementById('error-message').style.display = 'none';
        document.getElementById('ytd-chart-container').style.display = 'none';
        document.getElementById('ytd-summary').style.display = 'none';
        document.getElementById('segment-comparison').style.display = 'none';
    }

    showChart() {
        document.getElementById('loading-indicator').style.display = 'none';
        document.getElementById('error-message').style.display = 'none';
        document.getElementById('ytd-chart-container').style.display = 'block';
        document.getElementById('ytd-summary').style.display = 'grid';
        document.getElementById('segment-comparison').style.display = 'block';
    }

    showError(message) {
        document.getElementById('loading-indicator').style.display = 'none';
        document.getElementById('ytd-chart-container').style.display = 'none';
        document.getElementById('ytd-summary').style.display = 'none';
        document.getElementById('segment-comparison').style.display = 'none';

        const errorContainer = document.getElementById('error-message');
        errorContainer.style.display = 'flex';
        errorContainer.querySelector('.error-text').textContent = `Failed to load data: ${message}`;
    }
}

// Initialize on page load
const app = new YTDComparisonApp();

document.addEventListener('DOMContentLoaded', () => {
    app.init();
});

// Retry button handler
document.querySelector('.retry-button')?.addEventListener('click', () => {
    app.init();
});
