const { expect } = require('@playwright/test');
const { allure } = require('allure-playwright');
const { BasePage } = require('../base/BasePage');

// The shared dev environment drops search requests when several patient tests run
// at once, so a search is re-issued this many times before it is called failed.
const SEARCH_ATTEMPTS = 3;
const SEARCH_RETRY_PAUSE = 500;
// How long the list gets to settle after a search or a removal before it is read.
const LIST_SETTLE_TIMEOUT = 20_000;
// How long the list takes to answer a search or a filter before its results can
// change. An unchanged reading before this has passed means the answer is still on
// its way, not that the list has settled.
const LIST_MIN_SETTLE = 6_000;
// Text the confirmation box demands before the Remove button unlocks.
const REMOVAL_CONFIRMATION_WORD = 'DELETE';

// The page shows three dropdowns in a fixed order: sorting, then the date range,
// then the department. They carry no label of their own, only the value they
// currently hold, so they are addressed by position.
const SORT_DROPDOWN = 0;
const DATE_DROPDOWN = 1;
const DEPARTMENT_DROPDOWN = 2;

// Tabs of the patient list, all of which the waiting list shares.
const PATIENT_LIST_TABS = [
  'All Patients',
  'Waiting Patient',
  'Recent Patient',
  'Follow up Patient',
  'Drop out Patient',
];

class WaitingPatientPage extends BasePage {
  constructor(page) {
    super(page);

    // The waiting list is a tab of the patient list, reached from the same module menu.
    this.waitingPatientTab = this.page.getByRole('button', { name: 'Waiting Patient' });

    // Rows and the name each row shows. The name sits in its own span inside the
    // patient name button, followed by a separate span for the gender.
    this.waitingRows = this.page.locator('tbody tr');
    this.rowName = this.page.locator('span.font-semibold');
    // Each tab words its empty state differently. The waiting tab says "No patients
    // in waiting list" where the main list says "No patients found", so both are
    // matched rather than pinning one tab's wording.
    this.emptyListRow = this.page.getByText(/No patients/i);

    // Column chooser, its counter and the table headers it governs.
    this.columnsButton = this.page.getByRole('button', { name: /Columns/i });
    this.columnCheckboxes = this.page.getByRole('checkbox');
    this.tableHeaders = this.page.getByRole('columnheader');

    // Row action menu of the waiting list. Its delete entry is called plain
    // "Delete" here, while the patient list calls the same action "Delete Patient".
    this.rowActionsButton = this.page.getByRole('button', { name: 'More actions' });
    this.rowActionMenuItems = this.page.getByRole('menuitem');
    this.deleteMenuItem = this.page.getByRole('menuitem', { name: 'Delete', exact: true });

    // "Remove from Waiting List" modal. It unlocks only after DELETE is typed.
    this.removeHeading = this.page.getByRole('heading', { name: 'Remove from Waiting List' });
    this.removeDialog = this.page.getByRole('dialog').filter({ has: this.removeHeading });
    this.removeConfirmationInput = this.page.getByPlaceholder('Type DELETE');
    this.removeButton = this.removeDialog.getByRole('button', { name: 'Remove', exact: true });
    this.removeCancelledNotice = this.removeDialog.getByText(new RegExp('today\'s waiting list', 'i'));
  }

  // Opens the waiting list, which is a tab of the patient list.
  //
  // The app writes the session token while it settles after signing in, so the
  // token is awaited before navigating. Going straight to the waiting tab can
  // outrun that write and bounce the run back to the sign in page.
  //
  // The first list is awaited too. The tab appears before the table has loaded, and
  // touching a filter dropdown in that window is swallowed, which leaves the run
  // staring at an empty list for a filter that in fact matches patients.
  async openWaitingPatientList() {
    await this.page.waitForFunction(() => Boolean(window.localStorage.getItem('auth_token')));
    await this.page.goto('/patient-list?tab=waiting');
    await expect(this.waitingPatientTab).toBeVisible();
    await this.waitForListSettled();
  }

  // Types a query into the waiting list search box and waits for the list to react.
  //
  // The list answers a search after a few seconds, and reads empty until it has,
  // so the wait is for a settled list rather than a fixed pause.
  async searchWaitingPatients(query) {
    const before = await this.listState();

    await this.searchBox().fill(query);
    await this.waitForListSettled(before);
  }

  // Waits until the table shows either patient rows or the empty state, which is
  // the point where the list has finished reacting to a search.
  //
  // Rows already on screen are not proof of that, because the app leaves the
  // previous results up for a few seconds after a search or a filter. Waiting only
  // for "something is listed" therefore returns at once and hands the caller the
  // stale list, so a snapshot taken before the action is compared against the
  // current one instead.
  //
  // The empty state on its own is not proof either: the table flashes it while the
  // rows are being redrawn, so it is only trusted after the same reading has come
  // back several times running. A result set that legitimately comes back identical
  // settles the same way, which keeps a filter that changes nothing from hanging.
  async waitForListSettled(before = null) {
    const startedAt = Date.now();
    let previous = null;
    let steadyReads = 0;

    await expect
      .poll(
        async () => {
          const now = await this.listState();
          const key = `${now.names.join('|')}#${now.columns.join('|')}`;

          if (before && key !== before) {
            return true;
          }

          steadyReads = key === previous ? steadyReads + 1 : 0;
          previous = key;

          // An unchanged list only counts as settled once the app has had time to
          // answer and the same reading has come back more than once.
          return steadyReads >= 2 && Date.now() - startedAt >= LIST_MIN_SETTLE;
        },
        { timeout: LIST_SETTLE_TIMEOUT, intervals: [1_000] },
      )
      .toBe(true);
  }

  // What the table is showing right now: the names listed and the columns shown.
  // The two are compared together because a column change alters the table without
  // altering the rows.
  async listState() {
    return {
      names: await this.listVisiblePatientNames(),
      columns: await this.listColumnHeaders(),
    };
  }

  // Returns true once the list reports that nothing matched.
  async isEmptyListShown() {
    return (await this.emptyListRow.count()) > 0;
  }

  // The search box of the waiting list. Its accessible name comes from the
  // placeholder, because the input carries no label of its own.
  searchBox() {
    return this.page.getByRole('textbox', { name: 'Search by name, mobile number...' });
  }

  // Returns the names listed on the current page of results.
  async listVisiblePatientNames() {
    const rows = this.waitingRows;
    const count = await rows.count();
    const names = [];

    for (let index = 0; index < count; index += 1) {
      const name = await rows
        .nth(index)
        .locator(this.rowName)
        .first()
        .innerText({ timeout: 2_000 })
        .catch(() => null);

      if (name) {
        names.push(name.trim());
      }
    }

    return names;
  }

  // Returns true when a row with the given name is listed.
  async isPatientListed(name) {
    return (await this.page.getByText(name, { exact: true }).count()) > 0;
  }

  // The dropdown at the given position of the filter bar.
  dropdown(position) {
    return this.page.getByRole('combobox').nth(position);
  }

  // Picks an option from one of the filter bar dropdowns. The caller waits for the
  // list to react, because only the caller knows what the list showed beforehand.
  async chooseDropdownOption(position, option) {
    await this.dropdown(position).click();
    await this.page.getByRole('option', { name: option, exact: true }).click();
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
      await this.page.waitForTimeout(SEARCH_RETRY_PAUSE);
    }
  }

  // Reads the text a dropdown currently shows, which is how these unlabelled
  // controls report their own name.
  async dropdownLabel(position) {
    return (await this.dropdown(position).innerText()).trim();
  }

  // Switches the date range the list covers, for example Yesterday.
  async selectDateRange(option) {
    const before = await this.listState();

    await this.chooseDropdownOption(DATE_DROPDOWN, option);
    await this.waitForListSettled(before);
  }

  // Switches the department the list is narrowed to.
  async selectDepartment(option) {
    const before = await this.listState();

    await this.chooseDropdownOption(DEPARTMENT_DROPDOWN, option);
    await this.waitForListSettled(before);
  }

  // Switches the sort order, for example Name (A-Z).
  async selectSortOrder(option) {
    const before = await this.listState();

    await this.chooseDropdownOption(SORT_DROPDOWN, option);
    await this.waitForListSettled(before);
  }

  // Narrows the list to one doctor. The control marks the chosen doctor on the
  // button itself rather than through aria-pressed, so the choice is confirmed
  // by the Doctor column of every listed row instead.
  async selectDoctor(name) {
    const before = await this.listState();

    await this.page.getByRole('button', { name, exact: true }).first().click();
    await this.waitForListSettled(before);
  }

  // Returns the Doctor column of every listed row.
  async listVisibleDoctors() {
    return this.listColumnValues('Doctor');
  }

  // Returns the Department column of every listed row.
  async listVisibleDepartments() {
    return this.listColumnValues('Department');
  }

  // Returns one named column for every listed row. The column is addressed by its
  // header text so the caller never has to know its position.
  async listColumnValues(headerName) {
    const index = (await this.tableHeaders.allInnerTexts()).findIndex((h) => h.trim() === headerName);

    if (index < 0) {
      throw new Error(`The waiting list has no "${headerName}" column.`);
    }

    const rows = this.waitingRows;
    const count = await rows.count();
    const values = [];

    for (let row = 0; row < count; row += 1) {
      const cell = rows.nth(row).locator('td').nth(index);
      const value = await cell.innerText({ timeout: 2_000 }).catch(() => '');

      if (value.trim()) {
        values.push(value.trim());
      }
    }

    return values;
  }

  // Returns the header texts of the table, which change with the column chooser.
  async listColumnHeaders() {
    return (await this.tableHeaders.allInnerTexts()).map((h) => h.trim()).filter(Boolean);
  }

  // The counter the column chooser shows, for example "Columns (7/8)".
  async columnChooserCounter() {
    return (await this.columnsButton.first().innerText()).replace(/\s+/g, ' ').trim();
  }

  // Shows or hides one column and waits for the table to redraw.
  //
  // Each toggle is a button carrying the checkbox role, wrapped in a label naming
  // that column, so the wanted toggle is reached through its own label rather than
  // by position. The chooser lists its columns in a different order to the table,
  // so position would hide the wrong one.
  async setColumnVisible(columnName, visible) {
    const before = await this.listState();

    await this.columnsButton.first().click();

    const label = this.page
      .locator('label')
      .filter({ hasText: new RegExp(`^\\s*${columnName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`) })
      .first();

    await label.waitFor({ state: 'visible' });

    const toggle = label.getByRole('checkbox').first();
    await toggle.waitFor({ state: 'visible' });

    if ((await toggle.getAttribute('aria-checked')) === String(visible)) {
      await this.page.keyboard.press('Escape');
      await this.page.waitForTimeout(SEARCH_RETRY_PAUSE);

      return;
    }

    await toggle.click({ force: true });
    await this.waitForListSettled(before);
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(SEARCH_RETRY_PAUSE);
  }

  // Finds the name of the listed patient carrying the given mobile number.
  async patientNameByMobile(mobile) {
    const rows = this.waitingRows;
    const count = await rows.count();

    for (let row = 0; row < count; row += 1) {
      const cell = await rows.nth(row).locator('td').first().innerText();

      if (cell.includes(mobile)) {
        return (await rows.nth(row).locator('span.font-semibold').first().innerText()).trim();
      }
    }

    return null;
  }

  // Verifies every tab of the patient list is offered.
  async verifyPatientListTabs() {
    for (const tab of PATIENT_LIST_TABS) {
      await expect(this.page.getByRole('button', { name: tab, exact: true }).first()).toBeVisible();
    }
  }

  // Opens the row action menu of the first listed patient and returns its items.
  //
  // The menu grows with the patient's payment status, a settled bill adds the two
  // print entries, so the caller asserts on the entries every patient has rather
  // than on the full list.
  async openFirstRowActions() {
    await this.waitingRows.first().getByRole('button', { name: 'More actions' }).click();

    const items = (await this.rowActionMenuItems.allInnerTexts()).map((i) => i.trim());

    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(SEARCH_RETRY_PAUSE);

    return items;
  }

  // Searches for the name and then reports whether it is listed, which is what a
  // caller needs when it wants the answer for a search it has not just typed.
  async isPatientListedAfterSearch(name) {
    await this.searchWaitingPatients(name);

    return this.isPatientListed(name);
  }

  // Waits until the given name is listed, re-issuing the search when the shared
  // environment drops a request, and returns whether it ever showed up.
  async waitForPatientListed(name) {
    for (let attempt = 1; attempt <= SEARCH_ATTEMPTS; attempt += 1) {
      await this.searchWaitingPatients(name);

      if (await this.isPatientListed(name)) {
        return true;
      }

      await this.page.waitForTimeout(SEARCH_RETRY_PAUSE);
    }

    return false;
  }

  // Takes one patient out of the waiting list, following the removal modal.
  async removeFromWaitingList(name) {
    await allure.step(`Remove ${name} from the waiting list`, async () => {
      await this.openRowActions(name);
      await this.confirmRemoval();
      await this.verifyPatientNotWaiting(name);
    });
  }

  // Opens the row action menu of the given patient's row.
  async openRowActions(name) {
    await this.waitForPatientListed(name);

    const row = this.waitingRows.filter({ has: this.page.getByText(name, { exact: true }) }).first();
    await row.getByRole('button', { name: 'More actions' }).click();
    await expect(this.deleteMenuItem).toBeVisible();
  }

  // Picks Delete and unlocks the modal by typing the confirmation word.
  async confirmRemoval() {
    await this.deleteMenuItem.click();

    // The modal is only a queue removal, so it is worth asserting it is the
    // expected one before anything is removed.
    await expect(this.removeDialog).toBeVisible();
    await expect(this.removeCancelledNotice).toBeVisible();

    // The Remove button stays disabled until DELETE has been typed.
    await expect(this.removeButton).toBeDisabled();
    await this.removeConfirmationInput.fill(REMOVAL_CONFIRMATION_WORD);
    await expect(this.removeButton).toBeEnabled();

    await this.removeButton.click();
  }

  // Verifies the patient is no longer listed under its name.
  async verifyPatientNotWaiting(name) {
    for (let attempt = 1; attempt <= SEARCH_ATTEMPTS; attempt += 1) {
      await this.searchWaitingPatients(name);

      if (!(await this.isPatientListed(name))) {
        return;
      }

      // The row is still showing, so look again before giving up.
      await this.page.waitForTimeout(SEARCH_RETRY_PAUSE);
    }

    throw new Error(`"${name}" was still listed in the waiting list after being removed.`);
  }
}

module.exports = { WaitingPatientPage };
