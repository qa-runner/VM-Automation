const { expect } = require('@playwright/test');
const { BasePage } = require('../base/BasePage');

// How long the report gets to answer Apply or Reset. It answers in a few
// seconds, so a steady reading is only trusted after this wait.
const LIST_MIN_SETTLE = 5_000;

// The filter comboboxes in the order the page shows them.
const FILTER_CATEGORY = 0;
const FILTER_DOCTOR = 1;

// The report months print, for turning a listed date back into ISO input.
const MONTH_NUMBERS = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
};

// A money cell such as "5,670", "-4,835" or "0" as a number.
function parseMoney(text) {
  const cleaned = (text || '').replace(/,/g, '').trim();

  return cleaned === '' || cleaned === '—' || cleaned === '-' ? 0 : Number(cleaned);
}

class InvoiceReportPage extends BasePage {
  constructor(page) {
    super(page);

    // Heading, table and its empty state.
    this.reportHeading = this.page.getByRole('heading', { name: 'Invoice Report' });
    this.tableHeaders = this.page.getByRole('columnheader');
    this.bodyRows = this.page
      .locator('tbody tr')
      .filter({ hasNotText: 'Loading...' })
      .filter({ hasNotText: 'No records found.' });
    this.emptyMessage = this.page.getByText('No records found.');

    // Filter controls: date range, invoice number, text search and comboboxes.
    this.startInput = this.page.locator('#input-start-date');
    this.endInput = this.page.locator('#input-end-date');
    this.invoiceInput = this.page.locator('#input-invoice-no');
    this.searchBox = this.page.locator('#input-search');
    this.filterBoxes = this.page.getByRole('combobox');
    this.applyButton = this.page.getByRole('button', { name: 'Apply' });
    this.resetButton = this.page.getByRole('button', { name: 'Reset' });

    // Column chooser.
    this.columnsButton = this.page.getByRole('button', { name: 'Columns' });
  }

  // Opens the invoice report straight through its url. Rows are awaited, not
  // just steadiness: the report refetches in the background, so a steady
  // reading can catch it mid-refresh with nothing rendered yet.
  async openInvoiceReport() {
    await this.page.waitForFunction(() => Boolean(window.localStorage.getItem('auth_token')));
    await this.page.goto('/report/invoice');
    await expect(this.reportHeading).toBeVisible({ timeout: 20_000 });
    await this.awaitEntries();
  }

  // How many entry rows the report currently shows.
  async rowCount() {
    return this.bodyRows.count();
  }

  // Waits until the report actually lists entries. A single rows-present check
  // can catch a background refetch with nothing rendered, so every guard that
  // needs data awaits it instead of reading once.
  async awaitEntries() {
    await expect
      .poll(async () => this.rowCount(), { timeout: 60_000, intervals: [1_000] })
      .toBeGreaterThan(0);
  }

  // What the report shows right now: how many rows and what the first one says.
  async listState() {
    const count = await this.rowCount();
    const first = count > 0 ? await this.bodyRows.first().innerText().catch(() => '') : '';

    return `${count}#${first.replace(/\s+/g, ' ').trim()}`;
  }

  // Waits until the report stops changing what it shows. A zero-row report
  // with no empty message is still loading, never an answer, so the wait only
  // trusts states that carry rows or the empty message.
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

  // Values of one column across the listed rows, addressed by header name.
  async listColumnValues(headerName) {
    const headers = await this.tableHeaders.allInnerTexts();
    const index = headers.findIndex((header) => header.replace(/\s+/g, ' ').trim() === headerName);
    expect(index, `No report column is headed "${headerName}".`).toBeGreaterThanOrEqual(0);

    return this.bodyRows.locator(`td:nth-child(${index + 1})`).allInnerTexts();
  }

  // The first value of one column, awaited rather than read once.
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

  // The first usable value of one column: some invoices carry a dash where a
  // doctor would stand, and filtering to a dash is filtering to nothing.
  async firstUsableValue(headerName, timeout = 60_000) {
    let values = [];

    await expect
      .poll(
        async () => {
          values = (await this.listColumnValues(headerName).catch(() => []))
            .map((value) => value.trim())
            .filter((value) => value && value !== '-' && value !== '—');
          return values.length;
        },
        { timeout: 60_000, intervals: [1_000] },
      )
      .toBeGreaterThan(0);

    return values[0];
  }

  // Every value of one column, awaited rather than read once.
  async awaitColumnValues(headerName) {
    let values = [];

    await expect
      .poll(
        async () => {
          values = await this.listColumnValues(headerName).catch(() => []);
          return values.length;
        },
        { timeout, intervals: [1_000] },
      )
      .toBeGreaterThan(0);

    return values[0];
  }

  // The table headers as plain names, in order.
  async columnHeaders() {
    return (await this.tableHeaders.allInnerTexts()).map((header) => header.replace(/\s+/g, ' ').trim());
  }

  // Waits until the table renders its headers.
  async awaitColumns() {
    await expect
      .poll(async () => (await this.columnHeaders()).length, { timeout: 60_000, intervals: [1_000] })
      .toBeGreaterThan(0);
  }

  // Picks one option of a filter combobox without applying anything. Picking
  // alone never narrows the report; only Apply applies the controls. Opening
  // retries because the option layer sometimes renders under the click.
  async setFilter(filterIndex, label) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await this.filterBoxes.nth(filterIndex).click();

      try {
        const option = this.page.getByRole('option', { name: label, exact: true }).first();
        await option.waitFor({ state: 'visible', timeout: 8_000 });
        await option.click({ timeout: 8_000 });

        return;
      } catch {
        await this.page.keyboard.press('Escape').catch(() => null);
      }
    }

    throw new Error(`The report filter never offered "${label}" to pick.`);
  }

  // Picks the category filter. Exported by position so tests read intent, not index.
  async setCategory(label) {
    await this.setFilter(FILTER_CATEGORY, label);
  }

  // Picks the doctor filter.
  async setDoctor(label) {
    await this.setFilter(FILTER_DOCTOR, label);
  }

  // What a filter combobox currently reports. The control renders the choice
  // twice (visible label plus mirror node), so a doubled reading is halved.
  async selectedFilter(filterIndex) {
    const text = (await this.filterBoxes.nth(filterIndex).innerText().catch(() => ''))
      .replace(/\s+/g, ' ')
      .trim();

    if (text.length > 0 && text.length % 2 === 0 && text.slice(0, text.length / 2) === text.slice(text.length / 2)) {
      return text.slice(0, text.length / 2);
    }

    return text;
  }

  // Applies whatever the controls hold and waits for the report to answer.
  async applyFilters() {
    const before = await this.listState();

    await this.applyButton.click();
    await this.waitForListToSettle(before);
  }

  // Clears every control through Reset and waits for the report to answer.
  async resetFilters() {
    const before = await this.listState();

    await this.resetButton.click();
    await this.waitForListToSettle(before);
  }

  // Shows or hides one table column through the chooser, then leaves the
  // chooser so the table can render the change.
  async toggleColumn(name) {
    await this.columnsButton.click();
    await this.page.getByRole('checkbox', { name }).click();
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(2000);
  }

  // Opens the bill behind the first listed invoice.
  async openFirstBill() {
    await this.bodyRows.first().getByRole('button', { name: 'View' }).click();
    await this.page.waitForURL(/\/billing\/\d+/, { timeout: 20_000 });
  }

  // Returns from the bill to the report.
  async backToReport() {
    await this.page.goBack();
    await expect(this.reportHeading).toBeVisible({ timeout: 20_000 });
    await this.awaitEntries();
  }

  // Turns a listed date such as "05 Oct 2026" back into ISO input form.
  static toIso(listedDate) {
    const [day, mon, year] = listedDate.trim().split(' ');

    return `${year}-${MONTH_NUMBERS[mon]}-${day.padStart(2, '0')}`;
  }
}

module.exports = { InvoiceReportPage, parseMoney };
