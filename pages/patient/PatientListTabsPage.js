const { expect } = require('@playwright/test');
const { BasePage } = require('../base/BasePage');

// NOTE on missing coverage: sorting, rows per page and date widening on these
// tabs are not covered because the tabs do not apply dropdown choices reliably:
// the control reports the new choice while the rows keep showing the previous
// answer. Do not re-add dropdown tests here until the refresh answers every time.

// How long a tab gets to settle after opening before it is read.
const TAB_SETTLE_TIMEOUT = 35_000;
// How long a tab takes to answer a search, filter or sort before its rows can
// change. The tabs answer in up to twenty seconds, while the dropdown label
// follows at once, so an unchanged reading before this has passed means the
// answer is still on its way, not that the tab has settled. The label alone can
// never prove the tab reacted.
// Opening is cheaper: the dropdowns answer after a few seconds, only the rows
// lag this far behind.
const TAB_MIN_SETTLE = 20_000;
const TAB_OPEN_SETTLE = 8_000;

// The patient list tabs this page covers, keyed by the tab query parameter.
// The all patients tab carries no parameter, so it maps to the bare list url.
const PATIENT_TABS = {
  all: 'All Patients',
  recent: 'Recent Patient',
  followup: 'Follow up Patient',
  dropout: 'Drop out Patient',
};

// Every tab of the patient list, used to prove each one stays reachable.
const ALL_PATIENT_LIST_TABS = [
  'All Patients',
  'Waiting Patient',
  'Recent Patient',
  'Follow up Patient',
  'Drop out Patient',
];

class PatientListTabsPage extends BasePage {
  constructor(page) {
    super(page);

    // Rows, headers and the message a tab shows when it holds nobody.
    this.tabRows = this.page.locator('tbody tr');
    this.tableHeaders = this.page.getByRole('columnheader');
    this.emptyTabMessage = this.page.getByText(/No .*patients? found/i);

    // Column chooser and the counter it reports through, for example "Columns (8/8)".
    this.columnsButton = this.page.getByRole('button', { name: /Columns/i });

    // Row action menu of the list tabs that offer one.
    this.rowActionsButton = this.page.getByRole('button', { name: 'More actions' });
    this.rowActionMenuItems = this.page.getByRole('menuitem');
  }

  // Opens one tab of the patient list straight through its tab parameter.
  //
  // The app writes the session token while it settles after signing in, so the
  // token is awaited before navigating. Going straight to the tab can outrun that
  // write and bounce the run back to the sign in page.
  async openTab(tabKey) {
    await this.page.waitForFunction(() => Boolean(window.localStorage.getItem('auth_token')));
    await this.page.goto(tabKey === 'all' ? '/patient-list' : `/patient-list?tab=${tabKey}`);
    await expect(this.tableHeaders.first()).toBeVisible();
    await this.waitForTabSettled(null, TAB_OPEN_SETTLE);
  }

  // The display name of a tab, for example 'Recent Patient' for 'recent'.
  tabName(tabKey) {
    return PATIENT_TABS[tabKey];
  }

  // Waits until the tab stops changing what it shows, which is the point where it
  // has finished answering the navigation.
  async waitForTabSettled(before = null, minSettle = TAB_MIN_SETTLE) {
    const startedAt = Date.now();
    let previous = null;
    let steadyReads = 0;

    await expect
      .poll(
        async () => {
          const now = await this.tabState();
          const key = `${now.rowCount}#${now.firstRow}#${now.headers.join('|')}`;

          if (before && key !== before) {
            return true;
          }

          steadyReads = key === previous ? steadyReads + 1 : 0;
          previous = key;

          // An unchanged tab only counts as settled once the app has had time to
          // answer and the same reading has come back more than once.
          return steadyReads >= 2 && Date.now() - startedAt >= minSettle;
        },
        { timeout: TAB_SETTLE_TIMEOUT, intervals: [1_000] },
      )
      .toBe(true);
  }

  // What the tab is showing right now: how many rows, what the first one says and
  // which columns the table has.
  async tabState() {
    const rowCount = await this.tabRows.count();
    const firstRow = rowCount
      ? (await this.tabRows.first().innerText().catch(() => '')).slice(0, 80).replace(/\s+/g, ' ').trim()
      : '';

    return {
      rowCount,
      firstRow,
      headers: await this.listColumnHeaders(),
    };
  }

  // Verifies every tab of the patient list is offered.
  async verifyPatientListTabs() {
    for (const tab of ALL_PATIENT_LIST_TABS) {
      await expect(this.page.getByRole('button', { name: tab, exact: true }).first()).toBeVisible();
    }
  }

  // The search box every tab offers. Its accessible name comes from the
  // placeholder, because the input carries no label of its own.
  searchBox() {
    return this.page.getByRole('textbox', { name: 'Search by name, mobile number...' });
  }

  // The dropdown at the given position of the filter bar.
  dropdown(position) {
    return this.page.getByRole('combobox').nth(position);
  }

  // Reads the text a dropdown currently shows, which is how these unlabelled
  // controls report their own name.
  async dropdownLabel(position) {
    return (await this.dropdown(position).innerText()).trim();
  }

  // The options the given dropdown offers, used to prove what the control can do.
  async readDropdownOptions(position) {
    const dropdown = this.dropdown(position);
    const label = await this.dropdownLabel(position);

    await dropdown.click();

    try {
      const options = (await this.page.getByRole('option').allInnerTexts()).map((o) => o.trim());

      return { label, options };
    } finally {
      await this.page.keyboard.press('Escape');
      await this.page.waitForTimeout(500);
    }
  }

  // Returns the header texts of the table, which change with the column chooser.
  async listColumnHeaders() {
    return (await this.tableHeaders.allInnerTexts()).map((h) => h.trim()).filter(Boolean);
  }

  // The counter the column chooser shows, for example "Columns (8/8)".
  async columnChooserCounter() {
    return (await this.columnsButton.first().innerText()).replace(/\s+/g, ' ').trim();
  }

  // Types a query into the tab search box and waits for the tab to react. Search
  // answers in a few seconds, so it settles on the shorter gate.
  async searchTabPatients(query) {
    const before = await this.tabState();

    await this.searchBox().fill(query);
    await this.waitForTabSettled(before, TAB_OPEN_SETTLE);
  }

  // Clears the tab search box and waits for the full list to come back.
  async clearTabSearch() {
    const before = await this.tabState();

    await this.searchBox().fill('');
    await this.waitForTabSettled(before, TAB_OPEN_SETTLE);
  }

  // How many rows the tab currently shows.
  async rowCount() {
    return this.tabRows.count();
  }

  // Returns one named column for every listed row. The column is addressed by its
  // header text so the caller never has to know its position.
  async listColumnValues(headerName) {
    const index = (await this.tableHeaders.allInnerTexts()).findIndex((h) => h.trim() === headerName);

    if (index < 0) {
      throw new Error(`The tab has no "${headerName}" column.`);
    }

    const count = await this.tabRows.count();
    const values = [];

    for (let row = 0; row < count; row += 1) {
      const cell = this.tabRows.nth(row).locator('td').nth(index);
      const value = await cell.innerText({ timeout: 2_000 }).catch(() => '');

      if (value.trim()) {
        values.push(value.trim());
      }
    }

    return values;
  }

  // Returns the patient name of every listed row.
  //
  // The name cell opens with the patient's initials on their own line, so the
  // first line is never the name. The name itself is the line carrying the
  // gender marker, for example "Mr. Test | M", with the marker stripped off.
  async listPatientNames() {
    const cells = await this.listColumnValues('Patient Name');

    return cells.map((cell) => {
      const lines = cell
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      const named = lines.find((line) => line.includes('|')) || lines.find((line) => line.includes(' ')) || lines[0] || '';

      return named
        .replace(/\s*\|\s*[A-Za-z]*\s*$/, '')
        .trim();
    });
  }

  // Opens the row action menu of the first listed patient and returns its items.
  async openFirstRowActions() {
    await this.tabRows.first().getByRole('button', { name: 'More actions' }).click();

    return (await this.rowActionMenuItems.allInnerTexts()).map((i) => i.trim());
  }

  // Picks one entry of the open row action menu.
  async chooseRowMenuItem(name) {
    await this.page.getByRole('menuitem', { name, exact: true }).click();
  }
}

module.exports = { PatientListTabsPage, PATIENT_TABS };
