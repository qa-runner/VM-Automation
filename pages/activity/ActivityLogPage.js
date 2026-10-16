const { expect } = require('@playwright/test');
const { BasePage } = require('../base/BasePage');

// How long the log gets to answer a search, filter or page change. It answers
// in a few seconds, so a steady reading is only trusted after this wait.
const LIST_MIN_SETTLE = 5_000;

// The filter comboboxes in the order the page shows them.
const FILTER_MODULE = 0;
const FILTER_ACTION = 1;

class ActivityLogPage extends BasePage {
  constructor(page) {
    super(page);

    // Heading, subtitle, table and its empty state. The body rows exclude the
    // loading indicator and the empty message, which render as table rows but
    // carry no entries: counting them as rows lets a mid-refresh read pass for
    // data, and lets an empty list pass a rows-present check.
    this.logHeading = this.page.getByRole('heading', { name: 'User Activity Log' });
    this.logSubtitle = this.page.getByText('Track one log entry per save');
    this.tableHeaders = this.page.getByRole('columnheader');
    this.bodyRows = this.page
      .locator('tbody tr')
      .filter({ hasNotText: 'Loading...' })
      .filter({ hasNotText: 'No activity logs found.' });
    this.emptyMessage = this.page.getByText('No activity logs found.');

    // Filter controls: date range, three comboboxes, text search and reset.
    this.fromInput = this.page.locator('#input-from');
    this.toInput = this.page.locator('#input-to');
    this.filterBoxes = this.page.getByRole('combobox');
    this.searchBox = this.page.locator('#input-search');
    this.resetButton = this.page.getByRole('button', { name: 'Reset' });

    // Row detail dialog and pager.
    this.detailDialog = this.page.getByRole('dialog');
  }

  // Opens the user activity log straight through its url. Rows are awaited,
  // not just steadiness: the log refetches in the background, so a steady
  // reading can catch it mid-refresh with no rows rendered yet.
  async openActivityLog() {
    await this.page.waitForFunction(() => Boolean(window.localStorage.getItem('auth_token')));
    await this.page.goto('/report/user-activity');
    await expect(this.logHeading).toBeVisible({ timeout: 20_000 });
    await expect
      .poll(async () => this.rowCount(), { timeout: 60_000, intervals: [1_000] })
      .toBeGreaterThan(0);
  }

  // How many body rows the log currently shows.
  async rowCount() {
    return this.bodyRows.count();
  }

  // Waits until the log actually lists entries. A single rows-present check
  // can catch a background refetch with nothing rendered, so every guard that
  // needs data awaits it instead of reading once.
  async awaitEntries() {
    await expect
      .poll(async () => this.rowCount(), { timeout: 60_000, intervals: [1_000] })
      .toBeGreaterThan(0);
  }

  // What the log shows right now: how many rows and what the first one says.
  async listState() {
    const count = await this.rowCount();
    const first = count > 0 ? await this.bodyRows.first().innerText().catch(() => '') : '';

    return `${count}#${first.replace(/\s+/g, ' ').trim()}`;
  }

  // Waits until the log stops changing what it shows. A zero-row log with no
  // empty message is still loading, never an answer, so the wait only trusts
  // states that carry rows or the empty message. A reading that differs from
  // the state before the control was touched ends the wait at once; anything
  // else only counts as settled once the app has had time to answer.
  async waitForListToSettle(before = null, minSettle = LIST_MIN_SETTLE) {
    const startedAt = Date.now();
    let previous = null;
    let steadyReads = 0;

    await expect
      .poll(
        async () => {
          const now = await this.listState();
          const answered =
            (await this.rowCount()) > 0 || (await this.emptyMessage.count()) > 0;

          if (before && now !== before && answered) {
            return true;
          }

          steadyReads = now === previous ? steadyReads + 1 : 0;
          previous = now;

          return answered && steadyReads >= 2 && Date.now() - startedAt >= minSettle;
        },
        { timeout: 60_000, intervals: [1_000] },
      )
      .toBe(true);
  }

  // The first value of one column, awaited rather than read once: the log
  // refetches in the background, so a single read can catch it mid-refresh
  // with no rows rendered yet.
  async firstColumnValue(headerName) {
    let values = [];

    await expect
      .poll(
        async () => {
          values = await this.listColumnValues(headerName).catch(() => []);
          return values.length > 0 && values[0].trim() ? values[0].trim() : '';
        },
        { timeout: 60_000, intervals: [1_000] },
      )
      .not.toBe('');

    return values[0].trim();
  }

  // Values of one column across the visible rows, addressed by header name.
  // The trailing action column has no header, so it is never addressed here.
  async listColumnValues(headerName) {
    const headers = await this.tableHeaders.allInnerTexts();
    const index = headers.findIndex((header) => header.replace(/\s+/g, ' ').trim() === headerName);
    expect(index, `No activity log column is headed "${headerName}".`).toBeGreaterThanOrEqual(0);

    return this.bodyRows.locator(`td:nth-child(${index + 1})`).allInnerTexts();
  }

  // Searches the log and waits for it to answer. The search applies on Enter.
  async searchLogs(query) {
    const before = await this.listState();

    await this.searchBox.fill(query);
    await this.searchBox.press('Enter');
    await this.waitForListToSettle(before);
  }

  // Clears every filter through Reset and waits for the full log to come back.
  async resetFilters() {
    const before = await this.listState();

    await this.resetButton.click();
    await this.waitForListToSettle(before);
  }

  // Picks one option of a filter combobox by its position among the three
  // (module first, action second, entity third) and waits for the log to
  // answer. Options render in a portal, so they are matched page-wide with
  // exact names: 'Patient' must not match 'Patient Certificate'.
  async selectFilter(filterIndex, label) {
    const before = await this.listState();

    await this.filterBoxes.nth(filterIndex).click();
    await this.page.getByRole('option', { name: label, exact: true }).first().click();
    await this.waitForListToSettle(before);
  }

  // Picks the module filter. Exported by position so tests read intent, not index.
  async selectModule(label) {
    await this.selectFilter(FILTER_MODULE, label);
  }

  // Picks the action filter.
  async selectAction(label) {
    await this.selectFilter(FILTER_ACTION, label);
  }

  // What a filter combobox currently reports.
  async selectedFilter(filterIndex) {
    return (await this.filterBoxes.nth(filterIndex).innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
  }

  // Narrows the log to one date range, given as ISO days. Both fields take
  // the day in ISO form; Enter on the second one applies the range.
  async selectDateRange(fromIso, toIso) {
    const before = await this.listState();

    await this.fromInput.fill(fromIso);
    await this.toInput.fill(toIso);
    await this.toInput.press('Enter');
    await this.waitForListToSettle(before);
  }

  // Opens the detail dialog of the first listed entry.
  async openFirstDetail() {
    await this.bodyRows.first().locator('td').last().getByRole('button').click();
    await expect(this.detailDialog).toBeVisible({ timeout: 15_000 });
  }

  // Closes the detail dialog.
  async closeDetail() {
    await this.detailDialog.getByRole('button', { name: 'Close' }).click();
    await expect(this.detailDialog).toHaveCount(0, { timeout: 15_000 });
  }

  // Opens the given pager page. A new page always shows different entries,
  // so the wait only trusts readings that are non-empty and changed: trusting
  // a merely steady log here would bless the old page when the backend is slow.
  async gotoPage(pageNumber) {
    const before = await this.firstRowText();
    expect(before, 'The activity log held no entries to page from.').toBeTruthy();

    await this.page.getByRole('button', { name: String(pageNumber), exact: true }).click();
    await expect
      .poll(
        async () => {
          const now = await this.firstRowText();

          return now && now !== before ? now : '';
        },
        { timeout: 60_000, intervals: [1_000] },
      )
      .not.toBe('');
  }

  // Waits until the pager offers a second page. The pager renders after the
  // entries arrive, so a single check can catch it before the page count lands.
  async awaitSecondPage() {
    await expect
      .poll(async () => this.page.getByRole('button', { name: '2', exact: true }).count(), {
        timeout: 60_000,
        intervals: [1_000],
      })
      .toBeGreaterThan(0);
  }

  // The first visible row as plain text, for slice-change comparisons.
  async firstRowText() {
    return (await this.bodyRows.first().innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
  }
}

module.exports = { ActivityLogPage };
