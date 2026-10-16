const { expect } = require('@playwright/test');
const { InquiryPage } = require('../pages/inquiry/InquiryPage');

const INQUIRY_API = 'https://apidev.ayushmanager.com/api';

// The single inquiry this suite owns.
//
// The values are fixed rather than randomised because an inquiry cannot be
// removed again: the row action menu offers only "Add Follow-up" and "Edit",
// and DELETE /api/inquiries/{id} answers 405 with "Supported methods: GET, HEAD,
// POST". A per run value would therefore mean a new row every run and unbounded
// growth in the shared environment. One record is registered on the first run
// and reused by every run after it, so the suite stays self sufficient while
// leaving exactly one clearly named row instead of hundreds.
const SEEDED_INQUIRY = {
  firstName: 'AUTOSEED',
  lastName: 'Inquiry',
  mobile: '9000000001',
  email: 'autoseed.inquiry@example.com',
  get name() {
    return `${this.firstName} ${this.lastName}`;
  },
};

// Makes sure the seeded inquiry exists.
//
// It is idempotent: the record is looked up by name first and only registered
// when the search confirms it is absent, so calling it repeatedly costs one
// search and registers nothing after the first time.
async function ensureSeededInquiry(page, inquiryPage = new InquiryPage(page)) {
  await inquiryPage.searchInquiries(SEEDED_INQUIRY.name);

  // Only a confirmed empty result leads to a create. A search that never settles
  // must not be read as absence, or every such run would add another record.
  const outcome = await inquiryPage.waitForSearchOutcome(SEEDED_INQUIRY.name);

  if (outcome === 'matched') {
    await inquiryPage.verifySearchResultContains(SEEDED_INQUIRY.name);
    return SEEDED_INQUIRY;
  }

  expect(outcome, `Could not confirm whether "${SEEDED_INQUIRY.name}" already exists`).toBe('empty');

  const created = page.waitForResponse(
    (response) => response.request().method() === 'POST' && response.url().startsWith(`${INQUIRY_API}/inquiries`),
  );

  await inquiryPage.openAddInquiryDrawer();
  await inquiryPage.fillInquiryForm(SEEDED_INQUIRY);
  await inquiryPage.saveInquiry();

  const response = await created;
  expect(response.ok(), `Seeded inquiry was not created: ${response.status()}`).toBeTruthy();

  await inquiryPage.clearSearch();
  await inquiryPage.searchInquiries(SEEDED_INQUIRY.name);
  await inquiryPage.verifySearchResultContains(SEEDED_INQUIRY.name);

  return SEEDED_INQUIRY;
}

module.exports = { SEEDED_INQUIRY, ensureSeededInquiry };
