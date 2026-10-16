const { expect } = require('@playwright/test');
const { BasePage } = require('../base/BasePage');

// How long the advised list gets to answer a filter. It answers in a few
// seconds, so a steady reading is only trusted after this wait.
const FILTER_MIN_SETTLE = 6_000;

class AdvisedTherapiesPage extends BasePage {
  constructor(page) {
    super(page);

    // List heading, rows and headers.
    this.listHeading = this.page.getByRole('heading', { name: 'Advised Therapies' });
    this.tableHeaders = this.page.getByRole('columnheader');
    this.bodyRows = this.page.locator('tbody tr');

    // Empty state the list shows when a filter matches nothing.
    this.emptyMessage = this.page.getByText('No advised therapies found');

    // Package dialog opened by the Create Package button.
    this.packageDialog = this.page.getByRole('dialog');
  }

  // Opens the advised therapies straight through their url. Rows are awaited,
  // not just steadiness: the list refetches in the background, so a steady
  // reading can catch it mid-refresh with no rows rendered yet.
  async openAdvisedTherapies() {
    await this.page.waitForFunction(() => Boolean(window.localStorage.getItem('auth_token')));
    await this.page.goto('/advised-therapies');
    await expect(this.listHeading).toBeVisible({ timeout: 20_000 });
    await expect
      .poll(async () => this.rowCount(), { timeout: 30_000, intervals: [1_000] })
      .toBeGreaterThan(0);
  }

  // Picks one option of a button filter group, for example the Today date
  // filter or the Completed status filter, and waits for the list to answer.
  // Both groups open with their own All entry, so the wanted occurrence is
  // addressed by position: the date group first, the status group second.
  async selectFilterButton(name, occurrence = 0) {
    const before = await this.listState();

    await this.page.getByRole('button', { name, exact: true }).nth(occurrence).click();
    await this.waitForListToSettle(before);
  }

  // Whether the given filter button currently reports itself as the active
  // choice. The active entry carries the primary background.
  async isFilterActive(name, occurrence = 0) {
    const cls = await this.page
      .getByRole('button', { name, exact: true })
      .nth(occurrence)
      .getAttribute('class');

    return (cls || '').includes('bg-primary');
  }

  // Filters the list to one custom day. The Date entry reveals a date input,
  // which takes the day in ISO form.
  async selectCustomDate(isoDate) {
    const before = await this.listState();

    await this.page.getByRole('button', { name: 'Date', exact: true }).click();
    await this.page.locator('input[type="date"]').last().fill(isoDate);
    await this.waitForListToSettle(before);
  }

  // Searches the advised list and waits for it to answer.
  async searchAdvised(query) {
    const before = await this.listState();

    await this.searchBox().fill(query);
    await this.searchBox().press('Enter');
    await this.waitForListToSettle(before);
  }

  // Clears the search the same way and waits for the full list to come back.
  async clearSearch() {
    const before = await this.listState();

    await this.searchBox().fill('');
    await this.searchBox().press('Enter');
    await this.waitForListToSettle(before);
  }

  // The search box of the advised list, matched by pattern because only the
  // start of its placeholder is known.
  searchBox() {
    return this.page.getByPlaceholder(/Search patient name, mobile/);
  }

  // What the list is showing right now: how many rows and what the first one
  // says. Detail rows of an expanded record count as rows too.
  async listState() {
    const count = await this.bodyRows.count();
    const first = count
      ? (await this.bodyRows.first().innerText().catch(() => '')).slice(0, 80).replace(/\s+/g, ' ').trim()
      : '';

    return { key: `${count}#${first}` };
  }

  // Whether the list is still showing its loading indicator. A loading table
  // reads steady, so the settle below refuses to trust any reading taken while
  // it shows.
  async isLoading() {
    return (await this.page.getByText(/Loading/i).count()) > 0;
  }

  // Waits until the list stops changing what it shows after a filter.
  async waitForListToSettle(before = null) {
    const startedAt = Date.now();
    let previous = null;
    let steadyReads = 0;

    await expect
      .poll(
        async () => {
          if (await this.isLoading()) {
            return false;
          }

          const key = (await this.listState()).key;

          if (before && key !== before.key) {
            return true;
          }

          steadyReads = key === previous ? steadyReads + 1 : 0;
          previous = key;

          return steadyReads >= 2 && Date.now() - startedAt >= FILTER_MIN_SETTLE;
        },
        { timeout: 20_000, intervals: [1_000] },
      )
      .toBe(true);
  }

  // How many rows the list currently shows.
  async rowCount() {
    return this.bodyRows.count();
  }

  // Returns one named column for every listed row.
  async listColumnValues(headerName) {
    const index = (await this.tableHeaders.allInnerTexts()).findIndex((h) => h.trim() === headerName);

    if (index < 0) {
      throw new Error(`The advised list has no "${headerName}" column.`);
    }

    const count = await this.bodyRows.count();
    const values = [];

    for (let row = 0; row < count; row += 1) {
      const cell = this.bodyRows.nth(row).locator('td').nth(index);
      const value = await cell.innerText({ timeout: 2_000 }).catch(() => '');

      if (value.trim()) {
        values.push(value.trim().replace(/\s+/g, ' '));
      }
    }

    return values;
  }

  // Expands the first record to its treatment plan details. The button toggles,
  // so calling it twice collapses the record again.
  async toggleFirstRowDetails() {
    const before = await this.listState();

    await this.bodyRows.first().getByRole('button').first().click();
    await this.waitForListToSettle(before);
  }

  // Opens the package dialog.
  async openCreatePackage() {
    await this.page.getByRole('button', { name: 'Create Package' }).click();
    await expect(this.page.getByRole('heading', { name: 'Add Package' })).toBeVisible({
      timeout: 15_000,
    });
  }

  // Closes the package dialog without saving anything.
  async closeCreatePackage() {
    const dismiss = this.packageDialog.getByRole('button', { name: /^(Cancel|Close)$/ });

    if (await dismiss.count()) {
      await dismiss.first().click();
    } else {
      await this.page.keyboard.press('Escape');
    }

    await expect(this.packageDialog).toHaveCount(0, { timeout: 15_000 });
  }
}

module.exports = { AdvisedTherapiesPage };
