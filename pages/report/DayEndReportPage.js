const { expect } = require('@playwright/test');
const { BasePage } = require('../base/BasePage');

// How long the summary gets to answer Apply or Reset. It answers in several
// seconds, so a steady reading is only trusted after this wait.
const SUMMARY_MIN_SETTLE = 8_000;

// A money cell such as "30,768" or "4,774.5" as a number.
function parseAmount(text) {
  const cleaned = text.replace(/,/g, '').trim();

  return cleaned === '' || cleaned === '—' ? 0 : Number(cleaned);
}

class DayEndReportPage extends BasePage {
  constructor(page) {
    super(page);

    // Heading, date controls and actions.
    this.reportHeading = this.page.getByRole('heading', { name: 'Day End Report' });
    this.startInput = this.page.locator('#input-start-date');
    this.endInput = this.page.locator('#input-end-date');
    this.applyButton = this.page.getByRole('button', { name: 'Apply' });
    this.resetButton = this.page.getByRole('button', { name: 'Reset' });

    // Section headings and the three summary tables.
    this.sectionHeading = (name) => this.page.getByRole('heading', { name });
    this.summaryTables = this.page.locator('table');

    // The nothing-there state a range without data reports, with its retry.
    this.emptySummary = this.page.getByText('No summary data');
    this.emptyRangeMessage = this.page.getByText('No data available for the selected date range.');
    this.refreshButton = this.page.getByRole('button', { name: 'Refresh' });
  }

  // Opens the day end report straight through its url. The sections render
  // after the heading, so the footfall numbers are awaited rather than read once.
  async openDayEndReport() {
    await this.page.waitForFunction(() => Boolean(window.localStorage.getItem('auth_token')));
    await this.page.goto('/report/day-end');
    await expect(this.reportHeading).toBeVisible({ timeout: 20_000 });
    await this.awaitSections();
  }

  // Waits until the registration footfall numbers render.
  async awaitSections() {
    await expect
      .poll(async () => this.bodyText(), { timeout: 60_000, intervals: [1_000] })
      .toMatch(/MALE\s*\d+/);
  }

  // The page body as single-spaced text.
  async bodyText() {
    return (await this.page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
  }

  // A signature of the summary numbers, for settle comparisons.
  async summaryState() {
    const text = await this.bodyText();
    const footfall = text.match(/MALE\s*\d+\s*FEMALE\s*\d+\s*TOTAL\s*\d+/)?.[0] ?? 'empty';
    const revenue = text.match(/Revenue Summary.*?Total\s*([\d,.]+)/)?.[1] ?? 'empty';

    return `${footfall}#${revenue}`;
  }

  // Waits until the summary stops changing what it shows after Apply or Reset.
  // A summary with neither numbers nor the no-data message is still loading,
  // never an answer: the Apply button itself says Loading while the month
  // query runs, so the wait only trusts answered states.
  async waitForSummaryToSettle(before = null, minSettle = SUMMARY_MIN_SETTLE) {
    const startedAt = Date.now();
    let previous = null;
    let steadyReads = 0;

    await expect
      .poll(
        async () => {
          const now = await this.summaryState();
          const text = await this.bodyText();
          const answered =
            /MALE\s*\d+/.test(text) || (await this.emptySummary.count()) > 0;

          if (before && now !== before && answered) {
            return true;
          }

          steadyReads = now === previous ? steadyReads + 1 : 0;
          previous = now;

          return answered && steadyReads >= 2 && Date.now() - startedAt >= minSettle;
        },
        { timeout: 120_000, intervals: [1_000] },
      )
      .toBe(true);
  }

  // Narrows the summary to one date range and waits for it to answer.
  async applyDateRange(fromIso, toIso) {
    const before = await this.summaryState();

    await this.startInput.fill(fromIso);
    await this.endInput.fill(toIso);
    await this.applyButton.click();
    await this.waitForSummaryToSettle(before);
  }

  // Restores the report through Reset and waits for it to answer.
  async resetReport() {
    const before = await this.summaryState();

    await this.resetButton.click();
    await this.waitForSummaryToSettle(before);
  }

  // Registration footfall as numbers: male, female and total.
  async readRegistration() {
    const text = await this.bodyText();
    const match = text.match(/MALE\s*(\d+)\s*FEMALE\s*(\d+)\s*TOTAL\s*(\d+)/);
    expect(match, 'The registration footfall numbers never rendered.').toBeTruthy();

    return { male: Number(match[1]), female: Number(match[2]), total: Number(match[3]) };
  }

  // Cells of every row of one summary table, by table position.
  async readTableRows(tableIndex) {
    const rows = this.summaryTables.nth(tableIndex).locator('tbody tr');
    const count = await rows.count();
    const parsed = [];

    for (let index = 0; index < count; index += 1) {
      parsed.push(await rows.nth(index).locator('td').allInnerTexts());
    }

    return parsed.map((cells) => cells.map((cell) => cell.replace(/\s+/g, ' ').trim()));
  }

  // Cells of the footer total row of one summary table, by table position.
  async readTableFoot(tableIndex) {
    const cells = await this.summaryTables
      .nth(tableIndex)
      .locator('tfoot tr')
      .first()
      .locator('td')
      .allInnerTexts();

    return cells.map((cell) => cell.replace(/\s+/g, ' ').trim());
  }

  // Lines between two section headings, for the card lists without tables.
  async readSectionLines(fromHeading, toHeading) {
    const lines = (await this.page.locator('body').innerText().catch(() => ''))
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    const from = lines.findIndex((line) => line.includes(fromHeading));
    expect(from, `The "${fromHeading}" section never rendered.`).toBeGreaterThanOrEqual(0);

    let to = lines.findIndex((line, index) => index > from && line.includes(toHeading));

    if (to < 0) {
      to = lines.length;
    }

    return lines.slice(from + 1, to);
  }
}

module.exports = { DayEndReportPage, parseAmount };
