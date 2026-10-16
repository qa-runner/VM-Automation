const { expect } = require('@playwright/test');
const { BasePage } = require('../base/BasePage');

class BillingPage extends BasePage {
  constructor(page) {
    super(page);

    // Conversion heading the bill shows when it arrives from a therapy.
    this.convertHeading = this.page.getByRole('heading', { name: 'Convert to Bill' });
    this.saveBillButton = this.page.getByRole('button', { name: 'Save Bill' });

    // Therapy line items table and every form input of the bill.
    this.lineTable = this.page.locator('table').first();
    this.formInputs = this.page.locator('input');
  }

  // Every filled value of the bill form, in order.
  async filledInputValues() {
    const count = await this.formInputs.count();
    const values = [];

    for (let index = 0; index < count; index += 1) {
      values.push(await this.formInputs.nth(index).inputValue().catch(() => ''));
    }

    return values.filter((value) => value.trim());
  }

  // Headers of the therapy line items table.
  async lineTableHeaders() {
    return (
      await this.lineTable
        .locator('th')
        .allInnerTexts()
        .catch(() => [])
    ).map((header) => header.replace(/\s+/g, ' ').trim());
  }
}

module.exports = { BillingPage };
