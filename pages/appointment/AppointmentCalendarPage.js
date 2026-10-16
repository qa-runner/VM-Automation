const { expect } = require('@playwright/test');
const { BasePage } = require('../base/BasePage');

// How long the calendar heading gets to answer a day change. The heading lags
// the click by a few seconds, so a steady reading is only trusted after this wait.
const HEADING_MIN_SETTLE = 4_000;

class AppointmentCalendarPage extends BasePage {
  constructor(page) {
    super(page);

    // Calendar headings: the module title first, the selected day with its
    // appointment count second, for example "Monday, 05 October — 2 Appointments".
    this.calendarHeading = this.page.getByRole('heading', { name: 'Appointment Calendar' });
    this.selectedDayHeading = this.page.getByRole('heading').nth(1);

    // Day navigation and the booking dialog it opens.
    this.todayButton = this.page.getByRole('button', { name: 'Today' }).first();
    this.addButton = this.page.getByRole('button', { name: '+ ADD' });
    this.addDialog = this.page.getByRole('dialog');
  }

  // Opens the appointment calendar through the side menu, the way a user
  // reaches it, then waits for the month grid to render. Addressed by
  // destination href: the sidebar collapses to icons on some pages, leaving
  // the link without text to match on.
  async openAppointmentModule() {
    await this.page.locator('a[href="/appointment-calendar"]').first().click();
    await expect(this.calendarHeading).toBeVisible({ timeout: 20_000 });
    await this.waitForDayCells();
  }

  // Waits until the month grid renders its day cells.
  async waitForDayCells() {
    await expect
      .poll(async () => this.dayCellButtons().count(), { timeout: 20_000 })
      .toBeGreaterThan(0);
  }

  // Buttons of the month grid. Day cells read as the day number with the
  // appointment count after it, for example "3 5" for the third with five
  // appointments, while empty days read as the number alone.
  dayCellButtons() {
    return this.page.getByRole('button').filter({ hasText: /^\d+(\s+\d+)?$/ });
  }

  // Every day cell with its number and appointment count.
  async listDayCells() {
    const buttons = this.dayCellButtons();
    const count = await buttons.count();
    const cells = [];

    for (let index = 0; index < count; index += 1) {
      const text = ((await buttons.nth(index).innerText().catch(() => '')).replace(/\s+/g, ' ').trim());
      const match = text.match(/^(\d+)(?:\s+(\d+))?$/);

      if (match) {
        cells.push({ index, day: Number(match[1]), appointments: Number(match[2] ?? 0) });
      }
    }

    return cells;
  }

  // The selected day heading, for example "Monday, 05 October — 2 Appointments".
  async selectedDayText() {
    return (await this.selectedDayHeading.innerText()).replace(/\s+/g, ' ').trim();
  }

  // Picks a day cell by its position among the grid buttons and waits for the
  // heading to answer it.
  async selectDayCell(index) {
    const before = await this.selectedDayText();

    await this.dayCellButtons().nth(index).click();
    await this.waitForHeadingToSettle(before);
  }

  // Waits until the selected day heading stops changing after a day change.
  async waitForHeadingToSettle(before) {
    const startedAt = Date.now();
    let previous = null;
    let steadyReads = 0;

    await expect
      .poll(
        async () => {
          const now = await this.selectedDayText();

          if (now !== before) {
            return true;
          }

          steadyReads = now === previous ? steadyReads + 1 : 0;
          previous = now;

          return steadyReads >= 2 && Date.now() - startedAt >= HEADING_MIN_SETTLE;
        },
        { timeout: 20_000, intervals: [1_000] },
      )
      .toBe(true);
  }

  // Returns to the current day.
  async selectToday() {
    const before = await this.selectedDayText();

    await this.todayButton.click();
    await this.waitForHeadingToSettle(before);
  }

  // Opens the booking dialog. The heading renders before the form controls, so
  // the save button is awaited rather than the heading alone.
  async openAddAppointment() {
    await this.addButton.click();
    await expect(this.page.getByRole('heading', { name: 'Add Appointment' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(this.addDialog.getByRole('button', { name: 'Save' })).toBeVisible({ timeout: 15_000 });
  }

  // Closes the booking dialog without saving anything.
  async closeAddAppointment() {
    await this.addDialog.getByRole('button', { name: 'Close' }).click();
    await expect(this.addDialog).toHaveCount(0, { timeout: 15_000 });
  }

  // Submits the booking form as it stands, without filling anything.
  async submitAddAppointment() {
    await this.addDialog.getByRole('button', { name: 'Save' }).click();
  }

  // The validation messages the open booking form currently shows. Bare
  // required markers render whether or not the form was refused, so they never
  // count as errors on their own.
  async listBookingErrors() {
    const texts = await this.addDialog
      .locator('p.text-red-500, span.text-red-500, [class*="destructive"], [class*="error"]')
      .allInnerTexts()
      .catch(() => []);

    return texts.map((text) => text.trim()).filter((text) => text && text !== '*');
  }

  // Picks a patient through the autocomplete and checks their mobile number
  // fills in, which proves the record attached rather than bare text sitting in
  // the box. Never returns an unattached name: saving one books for nobody. The
  // suggestion index lags fresh registrations, so picking retries a few times.
  async pickPatient(fullName, mobileNumber) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await this.addDialog.getByLabel('Patient Name', { exact: true }).fill(fullName);

      try {
        await this.page.getByRole('option').first().waitFor({ state: 'visible', timeout: 10_000 });
        await this.page.getByRole('option').first().click({ timeout: 10_000 });
        await expect
          .poll(async () => this.addDialog.getByLabel('Mobile Number', { exact: true }).inputValue(), {
            timeout: 10_000,
          })
          .toBe(mobileNumber);

        return;
      } catch {
        // The suggestion list re-rendered under the click or the fresh record
        // is not indexed yet; re-issue the search.
      }
    }

    throw new Error(`Patient ${fullName} never attached to the booking form.`);
  }

  // Picks the department through its combobox, which loads the doctor options
  // behind it. The dialog holds four comboboxes in order: patient search,
  // mobile search, department, doctor. Radix renders the option list in a
  // portal, so options are matched page-wide.
  async selectDepartment(label) {
    await this.addDialog.getByRole('combobox').nth(2).click();
    await this.page.getByRole('option', { name: label }).first().click({ timeout: 10_000 });
  }

  // Picks a doctor by position among the loaded combobox options.
  async selectDoctorByIndex(index) {
    await this.addDialog.getByRole('combobox').nth(3).click();
    const options = this.page.getByRole('option');
    await options.first().waitFor({ state: 'visible', timeout: 10_000 });
    await options.nth(index).click();
  }

  // The scheduled appointment card for the given patient name.
  appointmentCard(fullName) {
    return this.page.locator('div[data-side-menu="true"]', { hasText: fullName }).first();
  }

  // Picks a day in the booking date picker for the given ISO date. The Date
  // control is the button that owns the calendar popover, so it is addressed
  // through that relationship rather than through its text, which is empty
  // until a day is picked. The picked day then renders in the dialog.
  async selectBookingDate(isoDate) {
    const [year, month, day] = isoDate.split('-').map(Number);
    const monthName = new Date(year, month - 1, day).toLocaleString('en', { month: 'short' });
    const wanted = `${String(day).padStart(2, '0')} ${monthName}`;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await this.addDialog.locator('button[aria-haspopup="dialog"]').first().click();
      await this.page.waitForTimeout(1500);

      try {
        const cell = this.page.getByRole('gridcell', { name: String(day), exact: true }).first();
        await cell.waitFor({ state: 'visible', timeout: 5_000 });
        await cell.click();
        await expect
          .poll(async () => this.addDialog.innerText().catch(() => ''), { timeout: 5_000 })
          .toContain(wanted);

        return;
      } catch {
        // The picker was not ready when the day was clicked; try the whole pick again.
      }
    }

    throw new Error(`The booking date picker never set ${isoDate}.`);
  }

  // Saves the booking and waits for the dialog to close, which the app only
  // does on success. The creation endpoint answers slowly under load, so the
  // poll gives it a full minute before calling the save lost. A refusal reads
  // back its own validation errors instead of timing out vaguely, and the
  // success toast is greetings rather than proof: the tests that need proof
  // count records instead.
  async saveAddAppointment() {
    await this.addDialog.getByRole('button', { name: 'Save' }).click();

    let outcome = 'pending';
    const startedAt = Date.now();
    await expect
      .poll(
        async () => {
          const errors = await this.listBookingErrors();
          if (errors.length > 0) {
            return (outcome = `refused: ${errors.join('; ')}`);
          }

          if ((await this.addDialog.count()) === 0) {
            return (outcome = 'saved');
          }

          if (Date.now() - startedAt > 60_000) {
            return (outcome = 'stayed open without an answer');
          }

          return (outcome = 'pending');
        },
        { timeout: 70_000, intervals: [500] },
      )
      .not.toBe('pending');

    expect(outcome, `The booking did not land (${outcome}).`).toBe('saved');
  }

  // Opens the given calendar date and returns its appointment count. Day
  // numbers repeat across the surrounding months, so candidates are tried
  // until the heading reports the wanted month and day.
  async openDate(date) {
    const dayLabel = `${date.getDate()} ${date.toLocaleString('en', { month: 'long' })}`;
    const cells = await this.listDayCells();
    const candidates = cells.filter((cell) => cell.day === date.getDate());
    expect(candidates.length, `No calendar cell shows day ${date.getDate()}.`).toBeGreaterThan(0);

    for (const cell of candidates) {
      await this.selectDayCell(cell.index);

      if ((await this.selectedDayText()).includes(dayLabel)) {
        return this.selectedDayCount();
      }
    }

    throw new Error(`No calendar cell opened ${dayLabel}.`);
  }

  // The appointment count the selected day heading reports.
  async selectedDayCount() {
    const match = (await this.selectedDayText()).match(/(\d+)\s+Appointments?/);

    if (!match) {
      throw new Error(`Could not read the appointment count from ${JSON.stringify(await this.selectedDayText())}.`);
    }

    return Number(match[1]);
  }
}

module.exports = { AppointmentCalendarPage };
