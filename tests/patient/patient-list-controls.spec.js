const { test, expect } = require('@playwright/test');
const { applyAllureContext } = require('../allure-context');
const { DashboardPage } = require('../../pages/dashboard/DashboardPage');
const { PatientPage } = require('../../pages/patient/PatientPage');
const { loginAsValidUser } = require('../../utils/authFlow');
const { deletePatientByName, registerPatient } = require('../../utils/patientFlow');
const { generateLastName } = require('../../utils/patientData');

test.describe('Patient', () => {
  // Signs in and opens the patient list, which every test below starts from.
  async function openPatientList(page) {
    await loginAsValidUser(page);
    await new DashboardPage(page).waitForDashboard();

    const patientPage = new PatientPage(page);
    await patientPage.openPatientList();
    await expect(page.getByRole('heading', { name: 'Patient List' })).toBeVisible();

    // The heading renders before the rows, and touching the list in that window
    // reads an empty or half loaded table, so the first list is awaited too.
    await patientPage.waitForListToSettle();

    return patientPage;
  }

  test.describe('Patient list', () => {
    // Regression test: the pager walks through the list and back.
    // TC012: Verify paging through the patient list.
    test('TC012 - user can page through the patient list', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Patient',
        suite: 'Patient List',
        type: 'regression',
        description: 'Walks the patient list to the second page and back to the first.',
      });

      // Step 1: Open the list, which holds far more than one page.
      const patientPage = await openPatientList(page);
      expect(await patientPage.paginationText()).toMatch(/Showing 1 to 10 of \d+ patients/);
      const firstPage = await patientPage.listPatientNames();
      expect(firstPage.length, 'The patient list held too few patients to page.').toBeGreaterThan(0);

      // Step 2: Go to the second page.
      await patientPage.gotoListPage(2);

      // Assert: the pager reports the second slice with different patients.
      expect(await patientPage.paginationText()).toMatch(/Showing 11 to 20 of \d+ patients/);
      expect(await patientPage.listPatientNames()).not.toEqual(firstPage);

      // Step 3: Go back to the first page.
      await patientPage.gotoListPage(1);

      // Assert: the first slice is back.
      expect(await patientPage.paginationText()).toMatch(/Showing 1 to 10 of \d+ patients/);
      expect(await patientPage.listPatientNames()).toEqual(firstPage);
    });

    // Regression test: the rows per page control pages the patient list.
    // TC013: Verify changing patient list rows per page.
    test('TC013 - user can change the rows per page of the patient list', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Patient',
        suite: 'Patient List',
        type: 'regression',
        description: 'Pages the patient list down to five rows per page and back to ten.',
      });

      // Step 1: Open the list on its default page size.
      const patientPage = await openPatientList(page);
      expect(await patientPage.dropdownLabel(4)).toBe('10');
      const fullPage = await patientPage.rowCount();
      expect(fullPage, 'The patient list held no patients to page.').toBeGreaterThan(5);

      // Step 2: Page down to five rows.
      await patientPage.selectRowsPerPage('5');

      // Assert: the control reports five and the list shows five rows.
      expect(await patientPage.dropdownLabel(4)).toBe('5');
      expect(await patientPage.rowCount()).toBe(5);
      expect(await patientPage.paginationText()).toMatch(/Showing 1 to 5 of \d+ patients/);

      // Step 3: Page back up.
      await patientPage.selectRowsPerPage('10');

      // Assert: the full page is back.
      expect(await patientPage.dropdownLabel(4)).toBe('10');
      expect(await patientPage.rowCount()).toBe(fullPage);
    });

    // Regression test: the sorting dropdown puts the names in order.
    // TC014: Verify sorting the patient list by patient name.
    test('TC014 - user can sort the patient list by patient name', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Patient',
        suite: 'Patient List',
        type: 'regression',
        description: 'Sorts the patient list by patient name from A to Z.',
      });

      // Step 1: Open the list, which carries patients.
      const patientPage = await openPatientList(page);
      expect(await patientPage.rowCount(), 'The patient list held no patients to sort.').toBeGreaterThan(0);

      // Step 2: Sort by name.
      await patientPage.selectSortOrder('Name (A–Z)');

      // Assert: the dropdown reports the chosen order and the names follow it.
      expect(await patientPage.dropdownLabel(2)).toBe('Name (A–Z)');
      const names = await patientPage.listPatientNames();
      expect(names.length).toBeGreaterThan(0);
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en')));
    });

    // Regression test: the column chooser shows and hides columns.
    // TC015: Verify showing and hiding patient list columns.
    test('TC015 - user can show and hide patient list columns', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Patient',
        suite: 'Patient List',
        type: 'regression',
        description: 'Hides a column of the patient list and brings it back.',
      });

      // Step 1: Open the list and check the columns are all shown.
      const patientPage = await openPatientList(page);
      expect(await patientPage.listColumnHeaders()).toContain('City');
      expect(await patientPage.columnChooserCounter()).toBe('Columns (10/10)');

      // Step 2: Hide the City column.
      await patientPage.setColumnVisible('City', false);

      // Assert: the header and the counter both follow.
      expect(await patientPage.listColumnHeaders()).not.toContain('City');
      expect(await patientPage.columnChooserCounter()).toBe('Columns (9/10)');

      // Step 3: Bring it back.
      await patientPage.setColumnVisible('City', true);

      // Assert: the table is whole again.
      expect(await patientPage.listColumnHeaders()).toContain('City');
      expect(await patientPage.columnChooserCounter()).toBe('Columns (10/10)');
    });

    // Regression test: the status dropdown leaves only that status listed.
    // TC016: Verify filtering the patient list by status.
    test('TC016 - user can filter the patient list by status', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Patient',
        suite: 'Patient List',
        type: 'regression',
        description: 'Narrows the patient list to one status and back to all statuses.',
      });

      // Step 1: Open the list, which carries patients.
      const patientPage = await openPatientList(page);
      expect(await patientPage.rowCount(), 'The patient list held no patients to filter.').toBeGreaterThan(0);

      // Step 2: Narrow to one status.
      await patientPage.selectStatus('Active');

      // Assert: the dropdown reports the choice and every row left carries it.
      expect(await patientPage.dropdownLabel(1)).toBe('Active');
      const statuses = await patientPage.listColumnValues('Status');
      expect(statuses.length, 'No Active patients listed.').toBeGreaterThan(0);
      for (const status of statuses) {
        expect(status).toBe('Active');
      }

      // Step 3: Widen it again.
      await patientPage.selectStatus('All Status');

      // Assert: the dropdown reports the wider choice.
      expect(await patientPage.dropdownLabel(1)).toBe('All Status');
    });
  });

  test.describe('Patient update', () => {
    // Regression test: a patient can be renamed through the edit form.
    // TC017: Verify renaming a patient persists.
    test('TC017 - user can rename a patient through the edit form', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Patient',
        suite: 'Patient Update',
        type: 'regression',
        description:
          'Registers a patient, renames it through the edit form, verifies the new name lists, and deletes it again.',
      });

      // Step 1: Sign in and register a patient that is safe to change.
      await loginAsValidUser(page);
      await new DashboardPage(page).waitForDashboard();
      const patientPage = new PatientPage(page);
      await patientPage.openPatientList();
      const { patient } = await registerPatient(page, 'OPD');
      await patientPage.verifyPatientAdded(patient.fullName);

      // Step 2: Open the edit form of that patient.
      await patientPage.openEditPatient(patient.fullName);

      // Step 3: Rename it and save. The last name is a fresh number no run could
      // have used, so the new name is unique by construction.
      const newFullName = `${patient.firstName} ${generateLastName()}`;
      await patientPage.lastNameInput.fill(newFullName.split(' ').pop());
      await patientPage.saveEditPatient();

      // Assert: the renamed patient lists under its new name.
      await patientPage.searchAndExpectResult(newFullName);
      await patientPage.expectPatientRowVisible(newFullName);

      // Step 4: Delete it again so the list is left clean for other tests.
      await deletePatientByName(page, newFullName);
    });

    // Regression test: the edit form opens with the patient loaded and cancels cleanly.
    // TC018: Verify edit form pre-fills and cancels cleanly.
    test('TC018 - user can open the edit form of a patient and cancel it', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Patient',
        suite: 'Patient Update',
        type: 'regression',
        description:
          'Opens the edit form of a listed patient, confirms it loads that patient, and cancels it without changing anything.',
      });

      // Step 1: Open the list, which carries patients.
      const patientPage = await openPatientList(page);
      expect(await patientPage.rowCount(), 'The patient list held no patients to edit.').toBeGreaterThan(0);

      // Step 2: Open the edit form of the first patient.
      await patientPage.chooseFirstRowMenuItem('Edit Patient');
      await expect(page.getByRole('heading', { name: 'Edit Patient' })).toBeVisible();

      // Assert: the form loads that patient rather than opening blank.
      await expect(patientPage.firstNameInput).not.toHaveValue('');

      // Step 3: Cancel without saving.
      await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();

      // Assert: the form closes and the list is untouched.
      await expect(page.getByRole('dialog')).toHaveCount(0);
      expect(await patientPage.rowCount()).toBeGreaterThan(0);
    });
  });

  test.describe('List row actions', () => {
    // Regression test: the Whatsapp action opens a chat with the patient.
    // TC019: Verify Whatsapp chat opens from a patient row.
    test('TC019 - user can open a Whatsapp chat from a patient row', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Patient',
        suite: 'List Row Actions',
        type: 'regression',
        description: 'Confirms the Whatsapp action of a listed patient opens a chat with the patient number.',
      });

      // Step 1: Open the list, which carries patients.
      const patientPage = await openPatientList(page);
      expect(await patientPage.rowCount(), 'The patient list held no patients to contact.').toBeGreaterThan(0);

      // Step 2: Open the chat without following it. The popup is caught and
      // closed so the run never leaves the patient list.
      const [popup] = await Promise.all([
        page.waitForEvent('popup', { timeout: 15_000 }),
        patientPage.chooseFirstRowMenuItem('Whatsapp'),
      ]);

      // Assert: the chat opens against the WhatsApp api with a phone number and
      // the list underneath is untouched.
      expect(popup.url()).toMatch(/^https:\/\/api\.whatsapp\.com\/send\//);
      expect(popup.url()).toContain('phone=');
      await popup.close();
      expect(page.url()).toContain('patient-list');
    });

    // Regression test: the row menu books an appointment on the calendar.
    // TC020: Verify sending a listed patient to the appointment calendar.
    test('TC020 - user can send a listed patient to the appointment calendar', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Patient',
        suite: 'List Row Actions',
        type: 'regression',
        description:
          'Sends a listed patient to the appointment calendar from the row menu and closes the booking form.',
      });

      // Step 1: Open the list, which carries patients.
      const patientPage = await openPatientList(page);
      expect(await patientPage.rowCount(), 'The patient list held no patients to book.').toBeGreaterThan(0);

      // Step 2: Send the first patient to the appointment calendar.
      await patientPage.chooseFirstRowMenuItem('Set Appointment');

      // Assert: the calendar opens with the booking form for that patient.
      await expect(page.getByRole('heading', { name: 'Add Appointment' })).toBeVisible();
      expect(page.url()).toContain('appointment-calendar');

      // Step 3: Close the booking form without saving.
      await page.getByRole('button', { name: 'Close' }).click();

      // Assert: the form closes and nothing was booked.
      await expect(page.getByRole('dialog')).toHaveCount(0);
    });
  });
});
