const { expect } = require('@playwright/test');
const { BasePage } = require('../base/BasePage');

// Arrow glyphs a sorted column carries in its header, as code points so no
// literal glyph ever travels through tooling that cannot carry it.
const SORT_ARROW_CODES = [0x2190, 0x2191, 0x2192, 0x2193, 0x2195, 0x21C5, 0x25B2, 0x25BC, 0x2B06, 0x2B07];

// Strips the sort arrows off a header text.
function stripSortArrows(text) {
  const arrows = String.fromCharCode(...SORT_ARROW_CODES);

  return text
    .split('')
    .filter((char) => !arrows.includes(char))
    .join('');
}

// How long the therapy list gets to answer a search, sort or page change. Like
// the patient tabs it answers in up to twenty seconds, so an unchanged reading
// before this has passed means the answer is still on its way.
const LIST_MIN_SETTLE = 20_000;
const LIST_SETTLE_TIMEOUT = 35_000;
const LIST_OPEN_SETTLE = 8_000;

class TherapyListPage extends BasePage {
  constructor(page) {
    super(page);

    // List heading, search, rows and headers.
    this.listHeading = this.page.getByRole('heading', { name: 'Patient Therapies' });
    this.tableHeaders = this.page.getByRole('columnheader');
    this.bodyRows = this.page.locator('tbody tr');

    // Rows per page control, the only dropdown of this list.
    this.rowsPerPage = this.page.getByRole('combobox');

    // Row action menu, which carries the single Convert to Bill entry.
    this.rowActionMenuItems = this.page.getByRole('menuitem');
  }

  // Opens the therapy list straight through its url. Rows are awaited, not
  // just steadiness: the list refetches in the background, so a steady reading
  // can catch it mid-refresh with no rows rendered yet.
  async openTherapyList() {
    await this.page.waitForFunction(() => Boolean(window.localStorage.getItem('auth_token')));
    await this.page.goto('/patient-therapies');
    await expect(this.listHeading).toBeVisible({ timeout: 20_000 });
    await expect
      .poll(async () => this.rowCount(), { timeout: 30_000, intervals: [1_000] })
      .toBeGreaterThan(0);
  }

  // Searches the list. The search only runs when it is committed with Enter;
  // filling the box alone leaves the list untouched.
  async searchTherapies(query) {
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

  // The search box of the therapy list.
  searchBox() {
    return this.page.getByRole('textbox', { name: 'Search by patient or therapy...' });
  }

  // Sorts one column through its header menu, which offers Asc, Desc and Hide.
  async sortColumn(headerName, direction) {
    const before = await this.listState();

    await this.runHeaderMenuAction(headerName, direction);
    await this.waitForListToSettle(before);
  }

  // Hides one column through its header menu. The list offers no unhide
  // control, so callers bring the columns back with a reload.
  async hideColumn(headerName) {
    const before = await this.listState();

    await this.runHeaderMenuAction(headerName, 'Hide');
    await this.waitForListToSettle(before);
  }

  // Runs one header menu entry. The menu opens on the header click and closes
  // under a slow click, so opening and picking retry as one unit. A click on an
  // open menu closes it, which the next attempt reopens, so no dismissal dance
  // is needed. Header names match loosely because a sorted column carries its
  // arrow glyph in the name.
  async runHeaderMenuAction(headerName, option) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await this.page.getByRole('columnheader', { name: headerName }).click();

      try {
        await this.page.getByRole('menuitem', { name: option, exact: true }).click({ timeout: 10_000 });

        return;
      } catch {
        // The menu closed before the click landed; reopen and try again.
      }
    }

    throw new Error(`Header menu "${option}" for "${headerName}" never stayed open.`);
  }

  // Shows that many rows per page, choosing from the only dropdown.
  async selectRowsPerPage(option) {
    const before = await this.listState();

    await this.rowsPerPage.click();
    await this.page.getByRole('option', { name: option, exact: true }).click();
    await this.waitForListToSettle(before);
  }

  // Every page size the rows per page control offers.
  async listRowsPerPageOptions() {
    await this.rowsPerPage.click();

    try {
      return (await this.page.getByRole('option').allInnerTexts()).map((o) => o.trim());
    } finally {
      await this.page.keyboard.press('Escape');
    }
  }

  // Goes to the given page of the list and waits for its slice to render. The
  // pager info advances before the rows follow it, so both have to arrive.
  async gotoTherapyPage(number, expectedStart) {
    const before = await this.bodyRows.first().innerText().catch(() => '');

    await this.page.getByRole('button', { name: String(number), exact: true }).click();

    await expect
      .poll(
        async () => {
          const info = await this.paginationText();
          const first = await this.bodyRows.first().innerText().catch(() => '');

          return info.includes(`Showing ${expectedStart} to`) && first !== before;
        },
        { timeout: 20_000 },
      )
      .toBe(true);
  }

  // The pagination line, for example "Showing 1 to 10 of 200 therapies".
  async paginationText() {
    return (
      await this.page
        .getByText(/Showing .* of \d+ therapies/)
        .first()
        .innerText()
        .catch(() => '')
    )
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Returns one named column for every listed row. The wanted header is awaited
  // because a read landing in a rebuild window misses it. Empty cells read as
  // empty strings and stay in place so ordering checks see the whole column.
  async listColumnValues(headerName) {
    let index = -1;

    await expect
      .poll(
        async () => {
          index = (await this.readColumnHeaders()).findIndex((h) => h === headerName);

          return index;
        },
        { timeout: 15_000 },
      )
      .toBeGreaterThanOrEqual(0);

    const count = await this.bodyRows.count();
    const values = [];

    for (let row = 0; row < count; row += 1) {
      const cell = this.bodyRows.nth(row).locator('td').nth(index);
      values.push((await cell.innerText({ timeout: 2_000 }).catch(() => '')).trim());
    }

    return values;
  }

  // What the list is showing right now: how many rows, what the first one says
  // and which columns the table has.
  async listState() {
    const count = await this.bodyRows.count();
    const first = count
      ? (await this.bodyRows.first().innerText().catch(() => '')).slice(0, 80).replace(/\s+/g, ' ').trim()
      : '';

    return { key: `${count}#${first}#${(await this.readColumnHeaders()).join('|')}` };
  }

  // Whether the list is still showing its loading indicator. A loading table
  // reads steady, so the settle below refuses to trust any reading taken while
  // it shows.
  async isLoading() {
    return (await this.page.getByText(/Loading/i).count()) > 0;
  }

  // Waits until the list stops changing what it shows after an action.
  async waitForListToSettle(before = null, minSettle = LIST_MIN_SETTLE) {
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

          return steadyReads >= 2 && Date.now() - startedAt >= minSettle;
        },
        { timeout: LIST_SETTLE_TIMEOUT, intervals: [1_000] },
      )
      .toBe(true);
  }

  // How many rows the list currently shows.
  async rowCount() {
    return this.bodyRows.count();
  }

  // Returns the header texts of the table in one shot, empty while the table
  // rebuilds itself and empty for real when every column hides.
  async readColumnHeaders() {
    return (await this.tableHeaders.allInnerTexts())
      .map((h) => stripSortArrows(h).trim())
      .filter(Boolean);
  }

  // Returns the header texts of the table, retrying through rebuild windows in
  // which a single read sees no headers at all. Only for assertions that need
  // headers present; absence checks use the raw read above.
  async listColumnHeaders() {
    let headers = [];

    await expect
      .poll(
        async () => {
          headers = await this.readColumnHeaders();

          return headers.length;
        },
        { timeout: 15_000 },
      )
      .toBeGreaterThan(0);

    return headers;
  }

  // Returns the patient of every listed row, which sits in the second cell.
  async listPatientNames() {
    const count = await this.bodyRows.count();
    const names = [];

    for (let row = 0; row < count; row += 1) {
      const value = await this.bodyRows.nth(row).locator('td').nth(1).innerText().catch(() => '');

      if (value.trim()) {
        names.push(value.trim());
      }
    }

    return names;
  }

  // Opens the row action menu of the first listed therapy and returns its items.
  // The list re-renders under an open menu and closes it, and a menu left open
  // covers the row button, so opening is retried as a unit with dismissal first.
  async openFirstRowActions() {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      if ((await this.page.getByRole('menuitem').count()) > 0) {
        await this.page.keyboard.press('Escape').catch(() => null);
        await this.page.waitForTimeout(500);
      }

      await this.bodyRows.first().getByRole('button').last().click();

      try {
        await this.page.getByRole('menuitem').first().waitFor({ state: 'visible', timeout: 5_000 });
        const items = (await this.rowActionMenuItems.allInnerTexts()).map((i) => i.trim());

        if (items.length > 0) {
          return items;
        }
      } catch {
        // The menu closed before it could be read; reopen it.
      }
    }

    throw new Error('The first row action menu never stayed open long enough to read.');
  }

  // Sends the first listed therapy to billing without saving any bill. Opening
  // and picking share one retry loop because the menu closes under a slow click.
  async convertFirstRowToBill() {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      if ((await this.page.getByRole('menuitem').count()) > 0) {
        await this.page.keyboard.press('Escape').catch(() => null);
        await this.page.waitForTimeout(500);
      }

      await this.bodyRows.first().getByRole('button').last().click();

      try {
        await this.page.getByRole('menuitem', { name: 'Convert to Bill', exact: true }).click({ timeout: 10_000 });
        break;
      } catch {
        // The menu closed before the click landed; reopen and try again.
      }
    }

    await expect(this.page.getByRole('heading', { name: 'Convert to Bill' })).toBeVisible({
      timeout: 20_000,
    });
  }
}

module.exports = { TherapyListPage };
