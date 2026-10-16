const { expect } = require('@playwright/test');
const { allure } = require('allure-playwright');
const { BasePage } = require('../base/BasePage');

const INQUIRY_URL = 'https://appdev.ayushmanager.com/new-inquiry';

// The nine summary cards shown above the list, with the accent colour each one
// carries. The colour is asserted as well as the label because it is the only
// thing that tells two same shaped cards apart, so a card silently losing its
// label would otherwise still pass on position alone.
const INQUIRY_STATUS_CARDS = [
  { label: 'New', accent: 'border-sky-200' },
  { label: 'In Progress', accent: 'border-amber-200' },
  { label: 'Interested', accent: 'border-cyan-200' },
  { label: 'Not Responding', accent: 'border-orange-200' },
  { label: 'Not Interested', accent: 'border-zinc-200' },
  { label: 'Converted', accent: 'border-green-200' },
  { label: 'Dead', accent: 'border-rose-200' },
  { label: 'Visited', accent: 'border-violet-200' },
  { label: 'Appointment Booked', accent: 'border-indigo-200' },
];

const STATUS_FILTER_OPTIONS = [
  'All Status',
  'New',
  'In Progress',
  'Interested',
  'Not Responding',
  'Not Interested',
  'Converted',
  'Dead',
  'Visited',
  'Appointment Booked',
];

const PRIORITY_FILTER_OPTIONS = ['All Priority', 'High', 'Medium', 'Low'];

const SOURCE_FILTER_OPTIONS = ['All Source', 'Telephonic', 'Direct Walk-in', 'Email', 'WhatsApp'];

// The status names a listed inquiry can carry, used to confirm a row really is an
// inquiry record rather than any other table row on the page.
const INQUIRY_STATUS_LABELS =
  'New|In Progress|Interested|Not Responding|Not Interested|Converted|Dead|Visited|Appointment Booked';

class InquiryPage extends BasePage {
  constructor(page) {
    super(page);

    // Sidebar entry that opens this module. The href is matched instead of the link
    // text: the sidebar renders shortly after login, so the link has to be awaited,
    // and its accessible name does not equal "Inquiry" exactly, which rules out an
    // exact role based lookup.
    this.inquiryMenuLink = this.page.locator('a[href="/new-inquiry"]');

    // Page heading and the primary action of the module.
    this.pageTitle = this.page.getByRole('heading', { name: 'Inquiry Management' });
    this.addInquiryButton = this.page.getByRole('button', { name: '+ Add Inquiry', exact: true });

    // List search box and the three filters.
    this.searchBox = this.page.getByPlaceholder('Search by name, mobile, email');
    this.filterSelects = this.page.locator('select');

    // Inquiry list rows, where the first row is the header.
    this.inquiryRows = this.page.getByRole('row');
    // Body rows only, used where the header must be out of the way.
    this.inquiryBodyRows = this.page.locator('tbody tr');

    // Pagination info showing total inquiry count (e.g. "1 - 10 of 727").
    this.paginationInfo = this.page.locator('div.text-sm.text-muted-foreground.whitespace-nowrap');

    // Rows per page combobox button.
    this.rowsPerPageButton = this.page.getByRole('combobox').filter({ hasText: /^\d+$/ });

    // Add inquiry drawer. Only first name, last name, mobile and email are bound to a
    // label, and they are the four fields the api accepts as the minimum needed to
    // register an inquiry, so they are addressed by label rather than by position.
    this.addInquiryDrawer = this.page.getByRole('dialog');
    this.firstNameInput = this.addInquiryDrawer.getByLabel('First Name', { exact: true });
    this.lastNameInput = this.addInquiryDrawer.getByLabel('Last Name', { exact: true });
    this.mobileInput = this.addInquiryDrawer.getByLabel('Mobile No', { exact: true });
    this.emailInput = this.addInquiryDrawer.getByLabel('Email', { exact: true });
    this.saveInquiryButton = this.addInquiryDrawer.getByRole('button', { name: 'Save Inquiry' });

    // Message the list shows while it has nothing to list. It is also rendered
    // briefly while the list is still loading, so it cannot be trusted on its own.
    this.noResultsMessage = this.page.getByText('No inquiries found');
  }

  // Returns the rows whose name cell contains the given text.
  inquiryRowsNamed(name) {
    return this.inquiryRows.filter({ hasText: name });
  }

  // Opens the add inquiry drawer and waits for its fields.
  async openAddInquiryDrawer() {
    await allure.step('Open add inquiry drawer', async () => {
      await this.addInquiryButton.click();
      await expect(this.firstNameInput).toBeVisible({ timeout: 15000 });
    });
  }

  // Fills the four fields the api needs to register an inquiry.
  async fillInquiryForm({ firstName, lastName, mobile, email }) {
    await this.firstNameInput.fill(firstName);
    await this.lastNameInput.fill(lastName);
    await this.mobileInput.fill(mobile);
    await this.emailInput.fill(email);
  }

  // Saves the drawer and waits for it to close, which the app only does on success.
  async saveInquiry() {
    await allure.step('Save the new inquiry', async () => {
      await this.saveInquiryButton.click();
      await expect(this.addInquiryDrawer).toHaveCount(0, { timeout: 20000 });
    });
  }

  // Cancels the drawer and waits for it to close without saving anything.
  async cancelAddInquiry() {
    await allure.step('Cancel the new inquiry', async () => {
      await this.addInquiryDrawer.getByRole('button', { name: 'Cancel' }).click();
      await expect(this.addInquiryDrawer).toHaveCount(0, { timeout: 20000 });
    });
  }

  // Opens the row action menu of the first listed inquiry and returns its items.
  // The row carries two buttons and renders them a beat apart, so clicking before
  // both are attached lands on the status picker instead of the menu. The menu
  // itself renders after the click, so it is awaited instead of read at once,
  // with one more click when the first one did not open it.
  async openFirstRowActions() {
    const rowButtons = this.inquiryBodyRows.first().getByRole('button');

    await expect
      .poll(async () => rowButtons.count(), { timeout: 10_000 })
      .toBeGreaterThanOrEqual(2);
    await rowButtons.last().click();

    try {
      await this.page.getByRole('menuitem').first().waitFor({ state: 'visible', timeout: 10_000 });
    } catch {
      await rowButtons.last().click();
      await this.page.getByRole('menuitem').first().waitFor({ state: 'visible', timeout: 10_000 });
    }

    return (await this.page.getByRole('menuitem').allInnerTexts()).map((i) => i.trim());
  }

  // Picks one entry of the first row's action menu. The menu is opened
  // separately through openFirstRowActions, so this only picks the entry.
  async chooseFirstRowMenuItem(name) {
    await this.chooseRowMenuItem(name);
  }

  // Picks one entry of the open row action menu.
  async chooseRowMenuItem(name) {
    await this.page.getByRole('menuitem', { name, exact: true }).click();
  }

  // Picks one entry of the row showing the given name, reopening its menu when
  // it closes before the click lands. The row is found by name rather than by
  // position because the page holds more than one table body. A menu left open
  // covers the row button, so it is dismissed first.
  async chooseRowMenuItemFor(name, item) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      if ((await this.page.getByRole('menuitem').count()) > 0) {
        await this.page.keyboard.press('Escape').catch(() => null);
        await this.page.waitForTimeout(500);
      }

      await this.inquiryRowsNamed(name).first().getByRole('button').last().click();

      try {
        await this.page.getByRole('menuitem', { name: item, exact: true }).click({ timeout: 10_000 });

        return;
      } catch {
        // The menu closed before the click landed; reopen and try again.
      }
    }

    throw new Error(`Row menu item "${item}" never stayed open long enough to click.`);
  }

  // Saves the open edit form and waits for it to close.
  async updateInquiry() {
    await allure.step('Save the edited inquiry', async () => {
      await this.addInquiryDrawer.getByRole('button', { name: 'Update Inquiry' }).click();
      await expect(this.addInquiryDrawer).toHaveCount(0, { timeout: 20_000 });
    });
  }

  // Goes to the given page of the list and waits for its slice to render. The
  // pager info advances before the rows follow it, so both have to arrive.
  async gotoInquiryPage(number, expectedStart) {
    const before = await this.inquiryBodyRows.first().innerText().catch(() => '');

    await this.page.getByRole('button', { name: String(number), exact: true }).click();

    await expect
      .poll(
        async () => {
          const info = (await this.paginationInfo.innerText().catch(() => '')).trim();
          const first = await this.inquiryBodyRows.first().innerText().catch(() => '');

          return info.includes(`${expectedStart} -`) && first !== before;
        },
        { timeout: 20_000 },
      )
      .toBe(true);
  }

  // Waits for a search to settle and reports whether it matched the given name.
// The list renders the same empty state while it is still loading as it does when
// there is genuinely nothing to show, so one sighting of it proves nothing: it has
// to stay visible across several polls before the search counts as empty.
async waitForSearchOutcome(name) {
  const EMPTY_CONFIRMATIONS = 3;
  let outcome = 'pending';
  let emptySightings = 0;

  await expect
    .poll(
      async () => {
        if ((await this.inquiryRowsNamed(name).count()) > 0) {
          emptySightings = 0;
          return (outcome = 'matched');
        }

        if (await this.noResultsMessage.first().isVisible()) {
          emptySightings += 1;
          return emptySightings >= EMPTY_CONFIRMATIONS ? (outcome = 'empty') : 'pending';
        }

        emptySightings = 0;
        return 'pending';
      },
      { timeout: 25000, intervals: [300] },
    )
    .not.toBe('pending');

  return outcome;
}

// Verifies at least one row contains the given name anywhere in the row.
// More than one match is reported but not failed on, because inquiries cannot be
// deleted from the product, so duplicates created by earlier runs cannot be cleared.
async verifySearchResultContains(name) {
  const matches = this.inquiryRowsNamed(name);
  await expect(matches.first()).toBeVisible({ timeout: 15000 });

  const count = await matches.count();
  if (count > 1) {
    console.warn(`[InquiryPage] "${name}" matched ${count} rows, expected one. Inquiries cannot be deleted, so these are permanent.`);
  }
}

  // Returns only the summary cards, which are told apart from the other rounded
  // cards on the page by holding both a label and a count.
  getStatusCards() {
    return this.page
      .locator('div.rounded-xl.border.bg-card')
      .filter({ has: this.page.locator('p.text-xs.text-muted-foreground') })
      .filter({ has: this.page.locator('p.text-2xl') });
  }

  // Returns the status filter, recognised by an option no other filter offers.
  getStatusFilter() {
    return this.filterSelects.filter({ has: this.page.locator('option', { hasText: 'Appointment Booked' }) });
  }

  // Returns the priority filter, recognised by its own "all" option.
  getPriorityFilter() {
    return this.filterSelects.filter({ has: this.page.locator('option', { hasText: 'All Priority' }) });
  }

  // Returns the source filter, recognised by the WhatsApp option.
  getSourceFilter() {
    return this.filterSelects.filter({ has: this.page.locator('option', { hasText: 'WhatsApp' }) });
  }

  // Waits until the inquiry list has finished loading.
  async waitForInquiryPage() {
    await this.pageTitle.waitFor({ state: 'visible', timeout: 15000 });
    await this.searchBox.waitFor({ state: 'visible', timeout: 15000 });
  }

  // Opens the module from the dashboard sidebar and waits for the list to load.
  async openFromDashboard() {
    await allure.step('Open inquiry page from dashboard', async () => {
      await this.inquiryMenuLink.waitFor({ state: 'visible', timeout: 15000 });
      await this.inquiryMenuLink.click();
      await expect(this.page).toHaveURL(INQUIRY_URL);
      await this.waitForInquiryPage();
    });
  }

  // Verifies the page reports the inquiry management title.
  async verifyPageTitle() {
    await expect(this.pageTitle).toBeVisible();
  }

  // Verifies the user was taken to the inquiry list route.
  async verifyPageUrl() {
    expect(this.page.url()).toBe(INQUIRY_URL);
  }

  // Verifies the add inquiry action is offered and enabled. The button is not
  // clicked here, because the registration form it opens is a separate test.
  async verifyAddInquiryButton() {
    await expect(this.addInquiryButton).toBeVisible();
    await expect(this.addInquiryButton).toBeEnabled();
  }

  // Verifies all nine summary cards are shown, each with its own label, its accent
  // colour and a numeric count.
  async verifyStatusCards() {
    const cards = this.getStatusCards();
    await expect(cards).toHaveCount(INQUIRY_STATUS_CARDS.length);

    for (const { label, accent } of INQUIRY_STATUS_CARDS) {
      const card = cards.filter({ has: this.page.getByText(label, { exact: true }) });

      await expect(card).toHaveCount(1);
      await expect(card).toHaveClass(new RegExp(accent));
      await expect(card.locator('p.text-2xl')).toHaveText(/^\d+$/);
    }
  }

  // Verifies the search box and the three filters are present, and that each filter
  // offers the full set of values in the documented order.
  async verifyFilters() {
    await expect(this.searchBox).toBeVisible();

    const filters = [
      [this.getStatusFilter(), STATUS_FILTER_OPTIONS],
      [this.getPriorityFilter(), PRIORITY_FILTER_OPTIONS],
      [this.getSourceFilter(), SOURCE_FILTER_OPTIONS],
    ];

    for (const [filter, expectedOptions] of filters) {
      await expect(filter).toBeVisible();

      const actualOptions = (await filter.locator('option').allTextContents()).map((option) => option.trim());
      expect(actualOptions).toEqual(expectedOptions);
    }
  }

  // Verifies the list rendered its header and at least one inquiry row. The rows load
  // after the page itself, so the count is polled instead of read once.
  async verifyInquiryRows() {
    await expect
      .poll(async () => await this.inquiryRows.count(), { timeout: 15000 })
      .toBeGreaterThan(1);

    const headerRow = this.inquiryRows.first();
    await expect(headerRow).toContainText('Name');
    await expect(headerRow).toContainText('Status');

    const firstRow = this.inquiryRows.nth(1);
    await expect(firstRow).toBeVisible();
    await expect(firstRow.getByText(new RegExp(`^(${INQUIRY_STATUS_LABELS})$`))).toBeVisible();
  }

  // Returns the total inquiry count shown in the pagination info.
  async getTotalInquiryCount() {
    await expect(this.paginationInfo).toBeVisible({ timeout: 15000 });
    const text = (await this.paginationInfo.innerText()).trim();
    const match = text.match(/of\s+(\d+)/);
    if (!match) {
      throw new Error(`Could not parse total inquiry count from pagination text: "${text}"`);
    }
    return parseInt(match[1], 10);
  }

  // Returns the count shown on each status card.
  async getCardCounts() {
    const cards = this.getStatusCards();
    const count = await cards.count();
    const counts = [];
    for (let i = 0; i < count; i++) {
      const text = (await cards.nth(i).locator('p.text-2xl').innerText()).trim();
      counts.push(parseInt(text, 10));
    }
    return counts;
  }

  // Verifies the sum of all card counts equals the total inquiry count.
  async verifyTotalCountMatchesCardSum() {
    const total = await this.getTotalInquiryCount();
    const cardCounts = await this.getCardCounts();
    const sum = cardCounts.reduce((a, b) => a + b, 0);
    expect(sum).toBe(total);
  }

  // Searches for inquiries by the given query and waits for results.
  async searchInquiries(query) {
    await allure.step(`Search inquiries: ${query}`, async () => {
      await this.searchBox.fill(query);
      await expect
        .poll(async () => await this.inquiryRows.count(), { timeout: 15000 })
        .toBeGreaterThan(1);
    });
  }

  // Clears the search box and waits for the full list to restore.
  async clearSearch() {
    await this.searchBox.fill('');
    await expect
      .poll(async () => await this.inquiryRows.count(), { timeout: 15000 })
      .toBeGreaterThan(1);
  }

  // Returns the rows per page combobox button.
  getRowsPerPageButton() {
    return this.rowsPerPageButton;
  }

  // Selects the given number of rows per page.
  async selectRowsPerPage(count) {
    await expect(this.rowsPerPageButton).toBeVisible({ timeout: 15000 });
    await this.rowsPerPageButton.click();
    await this.page.getByRole('option', { name: String(count), exact: true }).click();
  }

  // Verifies the expected number of data rows are shown.
  async verifyRowCount(count) {
    await expect
      .poll(async () => await this.inquiryRows.count(), { timeout: 15000 })
      .toBe(count + 1);
  }

  // Selects a status from the status filter dropdown.
  async selectStatus(status) {
    await allure.step(`Select status filter: ${status}`, async () => {
      await this.getStatusFilter().selectOption({ label: status });
    });
  }

  // Verifies all visible data rows have the given status.
  async verifyAllRowsHaveStatus(status) {
    const rowCount = await this.inquiryRows.count();
    for (let i = 1; i < rowCount; i++) {
      const row = this.inquiryRows.nth(i);
      const statusBadge = row.locator('div.inline-flex.items-center.rounded-full').first();
      await expect(statusBadge).toHaveText(status, { timeout: 15000 });
    }
  }

  // Selects a source from the source filter dropdown.
  async selectSource(source) {
    await allure.step(`Select source filter: ${source}`, async () => {
      await this.getSourceFilter().selectOption({ label: source });
    });
  }

  // Selects a priority from the priority filter dropdown and waits for the total
  // to answer it. The list itself shows no priority per row, so the total is what
  // proves the filter did anything.
  async selectPriority(priority) {
    await allure.step(`Select priority filter: ${priority}`, async () => {
      await this.getPriorityFilter().selectOption({ label: priority });
      await this.waitForTotalToSettle();
    });
  }

  // The priority the filter currently reports, read off its selected option.
  async getSelectedPriority() {
    return (await this.getPriorityFilter().locator('option:checked').textContent()).trim();
  }

  // Waits until the pagination total stops changing, which is the point where the
  // list has finished answering the filter. The total lags the selection by a few
  // seconds, so a steady reading alone is not trusted until that wait has passed.
  async waitForTotalToSettle() {
    const startedAt = Date.now();
    let previous = null;
    let steadyReads = 0;

    await expect
      .poll(
        async () => {
          const text = (await this.paginationInfo.innerText().catch(() => '')).trim();

          steadyReads = text === previous ? steadyReads + 1 : 0;
          previous = text;

          return steadyReads >= 2 && Date.now() - startedAt >= 4_000;
        },
        { timeout: 20_000, intervals: [1_000] },
      )
      .toBe(true);
  };

  // Verifies all visible data rows have the given source in the source column.
  async verifyAllRowsHaveSource(source) {
    const rowCount = await this.inquiryRows.count();
    for (let i = 1; i < rowCount; i++) {
      const row = this.inquiryRows.nth(i);
      const sourceCell = row.getByRole('cell').nth(2);
      await expect(sourceCell).toHaveText(source, { timeout: 15000 });
    }
  }
}

module.exports = { InquiryPage };