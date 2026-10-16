const { expect } = require('@playwright/test');
const { allure } = require('allure-playwright');
const { BasePage } = require('../base/BasePage');

// The shared dev environment drops search requests when several patient tests run
// at once, so a search is re-issued this many times before it is called failed.
// The budget is kept small on purpose: signing in and registering a patient already
// uses about 25s of the test timeout, so the search must not be what overruns it.
const SEARCH_ATTEMPTS = 3;
const SEARCH_SETTLE_TIMEOUT = 5_000;
const SEARCH_RETRY_PAUSE = 500;
// How long the list gets to answer a filter, sort or page change. The main list
// answers in a few seconds while its controls report the choice at once, so an
// unchanged reading before this has passed means the answer is still on its way.
const LIST_MIN_SETTLE = 6_000;
const LIST_SETTLE_TIMEOUT = 20_000;

class PatientPage extends BasePage {
  constructor(page) {
    super(page);

    // Patient module navigation.
    this.patientMainMenu = ':text-is("Patient")';
    this.patientListButton = "text=Patient List";
    this.addPatientButton = "button:has-text('Add Patient')";

    // Patient registration modal.
    this.registrationModalTitle = this.page.getByRole('heading', { name: 'Patient Registration' });
    this.firstNameInput = this.page.getByRole('textbox', { name: 'First Name *' });
    this.lastNameInput = this.page.getByRole('textbox', { name: /Last Name/i });
    this.mobileNumberInput = this.page.getByRole('textbox', { name: /Mobile number \*/i });
    this.additionalInformationTab = this.page.getByRole('heading', { name: 'Additional Information' });
    // The app renamed this field from "Select OPD / IPD" to "Category" and dropped
    // its placeholder, and every combobox in the modal now renders with no text at
    // all, so it can only be found through its label. The label is matched inside
    // the registration dialog to keep the list page's own category column out, and
    // each field renders two comboboxes, one of them hidden, hence the first().
    this.patientTypeDropdown = this.page
      .getByRole('dialog')
      .getByText('Category', { exact: true })
      .locator('xpath=..')
      .getByRole('combobox')
      .first();
    this.patientTypeOptions = this.page.getByRole('listbox').getByRole('option');
    this.registerPatientButton = this.page.getByRole('button', { name: /Register Patient/i });

    // Registration confirmation modal.
    this.confirmRegistrationHeading = this.page.getByRole('heading', { name: /Confirm registration/i });
    this.confirmDialog = this.page.getByRole('dialog').filter({ has: this.confirmRegistrationHeading });
    this.confirmRegistrationButton = this.confirmDialog.getByRole('button', { name: /^Register Patient$/i });

    // Patient list, rows and row actions.
    this.searchInput = this.page.getByPlaceholder('Search by name, mobile number...');
    this.patientRows = this.page.getByRole('row');
    this.bodyRows = this.page.locator('tbody tr');
    this.tableHeaders = this.page.getByRole('columnheader');
    this.deletePatientMenuItem = this.page.getByRole('menuitem', { name: 'Delete Patient' });
    this.rowActionMenuItems = this.page.getByRole('menuitem');
    this.emptyListRow = this.page.getByText('No patients found', { exact: true });

    // Filter bar dropdowns in position order: type, status, sorting, date range.
    // A rows per page control follows them.
    this.filterDropdown = this.page.getByRole('combobox');

    // Column chooser and pagination info, for example "Showing 1 to 10 of 444 patients".
    this.columnsButton = this.page.getByRole('button', { name: /Columns/i });
    this.paginationInfo = this.page.getByText(/Showing .* patients/);

    // Delete confirmation modal.
    this.deleteConfirmationMessage = this.page.getByText(
      'Are you sure you want to delete this patient? This action cannot be undone.',
      { exact: true }
    );
    this.deleteDialog = this.page.getByRole('dialog').filter({ has: this.deleteConfirmationMessage });
    this.deleteConfirmButton = this.deleteDialog.getByRole('button', { name: 'Delete', exact: true });

    // Holds the name captured by the poll that confirmed a name search matched.
    this.matchedPatientName = null;
  }

  // Opens the patient module and goes to the patient list. The sidebar entry is
  // addressed by role because its text also renders as the page heading once
  // the list is open, which a text lookup matches twice.
  async openPatientList() {
    await this.page.locator(this.patientMainMenu).click();
    await this.page.getByRole('link', { name: 'Patient List' }).first().click();
  }

  // Opens the add patient modal and waits for the registration form.
  async openAddPatientForm() {
    await this.page.locator(this.addPatientButton).click();
    await expect(this.registrationModalTitle).toBeVisible({ timeout: 15000 });
  }

  // Submits the registration form as it stands, without filling anything.
  async submitRegistrationForm() {
    await this.registerPatientButton.first().click();
  }

  // The validation messages the open registration form currently shows.
  async listValidationErrors() {
    const texts = await this.page
      .locator('[role="dialog"] p.text-red-500, [role="dialog"] span.text-red-500')
      .allInnerTexts()
      .catch(() => []);

    return texts.map((text) => text.trim()).filter(Boolean);
  }

  // Fills the patient registration form with generated values.
  async fillPatientDetails(firstName, lastName, mobileNumber) {
    await allure.step('Fill patient registration form', async () => {
      await this.firstNameInput.fill(firstName);
      await this.lastNameInput.fill(lastName);
      await this.mobileNumberInput.fill(mobileNumber);
    });
  }

  // Switches the registration modal to the additional information tab.
  async openAdditionalInformationTab() {
    await this.additionalInformationTab.click();
  }

  // Opens the OPD / IPD dropdown and picks the required patient type.
  async selectPatientType(patientType) {
    await this.patientTypeDropdown.click();
    await this.patientTypeOptions.filter({ hasText: new RegExp(`^${patientType}$`) }).click();
    await expect(this.getPatientTypeDropdown(patientType)).toBeVisible();
  }

  // Returns the patient type combobox once it displays the selected value. It is
  // found through the Category label like the dropdown itself, because the modal's
  // comboboxes expose no text until a value is chosen.
  getPatientTypeDropdown(patientType) {
    return this.patientTypeDropdown.filter({ hasText: new RegExp(`^${patientType}$`) });
  }

  // Submits the patient form and confirms the registration action in the modal.
  async submitRegistration() {
    await allure.step('Submit patient registration', async () => {
      await this.registerPatientButton.click();
      await expect(this.confirmDialog).toBeVisible({ timeout: 15000 });
      await this.confirmRegistrationButton.click();
    });
  }

  // Verifies that the new patient can be found in the list by full name.
  async verifyPatientAdded(fullName) {
    await this.searchAndExpectResult(fullName);
    await this.expectPatientRowVisible(fullName);
  }

  // Filters the patient list and waits until a row matching the query is listed.
  // A newly registered patient can briefly be missing from the list and a dropped
  // request leaves the previous list on screen, so both are retried instead of
  // being reported as a missing patient. Returns whether a match appeared.
  async searchPatients(query) {
    for (let attempt = 1; attempt <= SEARCH_ATTEMPTS; attempt += 1) {
      if (attempt > 1) {
        // Clearing first makes the app run a new search, because filling the box
        // with the value it already holds does not raise a change event.
        await this.searchInput.fill('');
        await this.page.waitForTimeout(SEARCH_RETRY_PAUSE);
      }

      await this.searchInput.fill(query);

      try {
        // expect.poll retries when the callback throws, which a hand written
        // loop does not, so a list re-rendering mid read costs one retry.
        await expect
          .poll(() => this.isMatchingRowListed(query), { timeout: SEARCH_SETTLE_TIMEOUT })
          .toBe(true);

        return true;
      } catch {
        // The list never showed the match, so re-issue the search.
      }
    }

    return false;
  }

  // Searches for the given name and returns it, or null when no matching row ever
  // appeared. The name is captured by the same poll that confirms the match,
  // because the list can re-render to a different patient between the two steps.
  async searchForPatientName(query) {
    for (let attempt = 1; attempt <= SEARCH_ATTEMPTS; attempt += 1) {
      if (attempt > 1) {
        await this.searchInput.fill('');
        await this.page.waitForTimeout(SEARCH_RETRY_PAUSE);
      }

      await this.searchInput.fill(query);

      try {
        await expect
          .poll(
            async () => {
              this.matchedPatientName = await this.readMatchingName(query);

              return this.matchedPatientName !== null;
            },
            { timeout: SEARCH_SETTLE_TIMEOUT }
          )
          .toBe(true);

        return this.matchedPatientName;
      } catch {
        // The list never showed the match, so re-issue the search.
      }
    }

    return null;
  }

  // Returns true when the first listed row contains the query. The read carries a
  // short timeout so a row that disappears mid read cannot outlive the poll.
  async isMatchingRowListed(query) {
    const row = await this.getFirstPatientRow();
    if (!row) {
      return false;
    }

    const rowText = (await row.innerText({ timeout: 2_000 })).toLowerCase();

    return rowText.includes(query.toLowerCase());
  }

  // Returns the name of the first listed row when it contains the query, or null
  // when the row is missing or shows a different patient.
  async readMatchingName(query) {
    const row = await this.getFirstPatientRow();
    if (!row) {
      return null;
    }

    const nameCell = row.locator('span.font-semibold').first();
    if ((await nameCell.count()) === 0) {
      return null;
    }

    const name = (await nameCell.innerText({ timeout: 2_000 })).trim();

    return name.toLowerCase().includes(query.toLowerCase()) ? name : null;
  }

  // Searches and fails with a clear message when no match ever appeared, so a
  // dropped request is not reported as a missing patient.
  async searchAndExpectResult(query) {
    if (!(await this.searchPatients(query))) {
      throw new Error(
        `The patient list never showed a match for "${query}" after ${SEARCH_ATTEMPTS} attempts.`
      );
    }
  }

  // Returns the first patient row once it is visible, or null when the list shows
  // no record. Callers poll this, so it must never throw.
  async getFirstPatientRow() {
    const firstRow = this.patientRows.nth(1);

    if (!(await firstRow.isVisible())) {
      return null;
    }

    const hasName = (await firstRow.locator('span.font-semibold').count()) > 0;

    return hasName ? firstRow : null;
  }

  // Returns the rows that show the given patient name.
  getRowByPatientName(fullName) {
    return this.patientRows.filter({ has: this.page.getByText(fullName, { exact: true }) });
  }

  // Verifies the patient is listed exactly once.
  async expectPatientRowVisible(fullName) {
    await expect(this.getRowByPatientName(fullName)).toHaveCount(1, { timeout: 20000 });
  }

  // Returns the name, mobile number and UHID shown for the given patient.
  async getPatientRowDetails(fullName) {
    await this.searchAndExpectResult(fullName);
    await this.expectPatientRowVisible(fullName);

    const patientRow = this.getRowByPatientName(fullName);

    return {
      name: (await patientRow.locator('span.font-semibold').first().innerText()).trim(),
      mobileNumber: (await patientRow.locator('p').first().innerText()).trim(),
      uhid: (await patientRow.getByRole('cell').filter({ hasText: /^UHID\// }).first().innerText()).trim(),
    };
  }

  // Opens the action menu of the row that shows the given patient name. The list
  // re-renders under an open menu and closes it, so the open is retried until a
  // menu item stays visible.
  async openRowActions(fullName) {
    await this.searchAndExpectResult(fullName);
    await this.expectPatientRowVisible(fullName);

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await this.getRowByPatientName(fullName).getByRole('button', { name: 'More actions' }).click();

      try {
        await this.page.getByRole('menuitem').first().waitFor({ state: 'visible', timeout: 5_000 });

        return;
      } catch {
        // The menu closed before it could be used; reopen it.
      }
    }

    throw new Error(`The row menu of "${fullName}" never stayed open.`);
  }

  // Picks Delete Patient from the open row action menu and opens the modal.
  async openDeletePatientModal() {
    await expect(this.deletePatientMenuItem).toBeVisible();
    await this.deletePatientMenuItem.click();
    await expect(this.deleteDialog).toBeVisible();
  }

  // Confirms the deletion in the modal.
  async confirmDelete() {
    await allure.step('Confirm patient deletion', async () => {
      await this.deleteConfirmButton.click();
    });
  }

  // Verifies the patient is gone by searching for it and expecting no match. The
  // box is cleared before the name is typed again, because it still holds that name
  // from the search that opened the row action menu. Clearing alone shows the
  // unfiltered list, so the pause lets the app settle on the cleared box before the
  // name is typed, otherwise that request can land last and hide the empty result.
  async verifyPatientNotPresent(fullName) {
    for (let attempt = 1; attempt <= SEARCH_ATTEMPTS; attempt += 1) {
      await this.searchInput.fill('');
      await this.page.waitForTimeout(SEARCH_RETRY_PAUSE);
      await this.searchInput.fill(fullName);

      try {
        await expect
          .poll(() => this.isEmptyListShown(), { timeout: SEARCH_SETTLE_TIMEOUT })
          .toBe(true);
        await expect(this.page.getByText(fullName, { exact: true })).toHaveCount(0);

        return;
      } catch {
        // The clear and the name search raced, so retype the name and look again.
      }
    }

    throw new Error(`The patient list still listed a patient matching "${fullName}" after deleting it.`);
  }

  // Returns true once the list reports that no patient matched the search.
  async isEmptyListShown() {
    return (await this.emptyListRow.count()) > 0;
  }

  // The dropdown at the given position of the filter bar.
  dropdown(position) {
    return this.filterDropdown.nth(position);
  }

  // Reads the text a dropdown currently shows, which is how these unlabelled
  // controls report their own name.
  async dropdownLabel(position) {
    return (await this.dropdown(position).innerText()).trim();
  }

  // Picks an option from one of the filter bar dropdowns and waits for the list.
  async chooseDropdownOption(position, option) {
    const before = await this.listState();

    await this.dropdown(position).click();
    await this.page.getByRole('option', { name: option, exact: true }).click();
    await this.waitForListToSettle(before);
  }

  // What the list is showing right now: how many rows, what the first one says
  // and which columns the table has.
  async listState() {
    const count = await this.bodyRows.count();
    const first = count
      ? (await this.bodyRows.first().innerText().catch(() => '')).slice(0, 80).replace(/\s+/g, ' ').trim()
      : '';

    return {
      key: `${count}#${first}#${(await this.listColumnHeaders()).join('|')}`,
    };
  }

  // Waits until the list stops changing what it shows after a filter, sort or
  // page change. The controls report the choice at once while the rows lag
  // seconds behind, so the label alone can never prove the list reacted.
  async waitForListToSettle(before = null) {
    const startedAt = Date.now();
    let previous = null;
    let steadyReads = 0;

    await expect
      .poll(
        async () => {
          const key = (await this.listState()).key;

          if (before && key !== before.key) {
            return true;
          }

          steadyReads = key === previous ? steadyReads + 1 : 0;
          previous = key;

          return steadyReads >= 2 && Date.now() - startedAt >= LIST_MIN_SETTLE;
        },
        { timeout: LIST_SETTLE_TIMEOUT, intervals: [1_000] },
      )
      .toBe(true);
  }

  // Switches the sort order, for example Name (A-Z).
  async selectSortOrder(option) {
    await this.chooseDropdownOption(2, option);
  }

  // Switches the status the list is narrowed to, for example Active.
  async selectStatus(option) {
    await this.chooseDropdownOption(1, option);
  }

  // Shows that many rows per page, for example 5. The control trails the four
  // shared filters.
  async selectRowsPerPage(option) {
    const position = (await this.filterDropdown.count()) - 1;

    await this.chooseDropdownOption(position, option);
  }

  // Goes to the given page of the list.
  async gotoListPage(number) {
    const before = await this.listState();

    await this.page.getByRole('button', { name: String(number), exact: true }).click();
    await this.waitForListToSettle(before);
  }

  // The pagination line, for example "Showing 1 to 10 of 444 patients".
  async paginationText() {
    return (await this.paginationInfo.first().innerText()).replace(/\s+/g, ' ').trim();
  }

  // How many rows the list currently shows.
  async rowCount() {
    return this.bodyRows.count();
  }

  // Returns the header texts of the table, which change with the column chooser.
  async listColumnHeaders() {
    return (await this.tableHeaders.allInnerTexts()).map((h) => h.trim()).filter(Boolean);
  }

  // The counter the column chooser shows, for example "Columns (10/10)".
  async columnChooserCounter() {
    return (await this.columnsButton.first().innerText()).replace(/\s+/g, ' ').trim();
  }

  // Shows or hides one column. Each toggle is a button carrying the checkbox
  // role, wrapped in a label naming that column, so the wanted toggle is reached
  // through its own label rather than by position.
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
      await this.page.keyboard.press('Escape').catch(() => null);
      await this.page.waitForTimeout(SEARCH_RETRY_PAUSE);

      return;
    }

    await toggle.click({ force: true });
    await this.waitForListToSettle(before);
    await this.page.keyboard.press('Escape').catch(() => null);
    await this.page.waitForTimeout(SEARCH_RETRY_PAUSE);
  }

  // Returns one named column for every listed row. The column is addressed by its
  // header text so the caller never has to know its position.
  async listColumnValues(headerName) {
    const index = (await this.tableHeaders.allInnerTexts()).findIndex((h) => h.trim() === headerName);

    if (index < 0) {
      throw new Error(`The patient list has no "${headerName}" column.`);
    }

    const count = await this.bodyRows.count();
    const values = [];

    for (let row = 0; row < count; row += 1) {
      const cell = this.bodyRows.nth(row).locator('td').nth(index);
      const value = await cell.innerText({ timeout: 2_000 }).catch(() => '');

      if (value.trim()) {
        values.push(value.trim());
      }
    }

    return values;
  }

  // Returns the patient name of every listed row. The name cell opens with the
  // patient's initials on their own line, so the line carrying the gender marker
  // is the name, for example "QA Anil 1625 | M", with the marker stripped off.
  async listPatientNames() {
    const cells = await this.listColumnValues('Patient Name');

    return cells.map((cell) => {
      const lines = cell
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      const named = lines.find((line) => line.includes('|')) || lines.find((line) => line.includes(' ')) || lines[0] || '';

      return named.replace(/\s*\|\s*[A-Za-z]*\s*$/, '').trim();
    });
  }

  // Opens the row action menu of the first listed patient and returns its items.
  // The list re-renders under an open menu and closes it, so opening and
  // reading are retried as one unit instead of trusting the first attempt. A
  // menu left open covers the row button, so it is dismissed first.
  async openFirstRowActions() {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await this.dismissRowMenu();
      await this.bodyRows.first().getByRole('button', { name: 'More actions' }).click();

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

  // Dismisses an open row menu, if there is one.
  async dismissRowMenu() {
    if ((await this.page.getByRole('menuitem').count()) > 0) {
      await this.page.keyboard.press('Escape').catch(() => null);
      await this.page.waitForTimeout(500);
    }
  }

  // Picks one entry of the first row's action menu, reopening it when the list
  // re-render beats the click to it. A click that fired before the menu closed
  // still counts: callers waiting on its effect observe that independently.
  //
  // Names match by substring because the icon font contributes an invisible
  // glyph to the accessible name of the Whatsapp entry, so an exact match never
  // resolves it while the visible text reads plainly. Every entry name is still
  // unique within this menu.
  async chooseFirstRowMenuItem(name) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await this.dismissRowMenu();
      await this.bodyRows.first().getByRole('button', { name: 'More actions' }).click();

      try {
        await this.page.getByRole('menuitem', { name }).click({ timeout: 10_000 });

        return;
      } catch {
        // The menu closed before the click landed; reopen and try again.
      }
    }

    throw new Error(`Row menu item "${name}" never stayed open long enough to click.`);
  }

  // Picks one entry of the open row action menu.
  async chooseRowMenuItem(name) {
    await this.page.getByRole('menuitem', { name, exact: true }).click();
  }

  // Opens the edit form of the given patient, which the row menu offers next to
  // the delete entry on every row. The menu pick is retried once through a fresh
  // open, because the list can close the menu before the click lands.
  async openEditPatient(name) {
    await this.openRowActions(name);

    try {
      await this.chooseRowMenuItem('Edit Patient');
    } catch {
      await this.openRowActions(name);
      await this.chooseRowMenuItem('Edit Patient');
    }

    await expect(this.page.getByRole('heading', { name: 'Edit Patient' })).toBeVisible({ timeout: 15_000 });
  }

  // Saves the open edit form and waits for it to close.
  async saveEditPatient() {
    await this.page.getByRole('button', { name: 'Update Patient' }).click();
    await expect(this.page.getByRole('dialog')).toHaveCount(0, { timeout: 20_000 });
  }
}

module.exports = { PatientPage };
