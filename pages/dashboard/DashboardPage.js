const { expect } = require('@playwright/test');
const { allure } = require('allure-playwright');
const { BasePage } = require('../base/BasePage');

// How long the appointments widget gets to answer a tab switch. The widget
// answers in a few seconds, so a steady reading is only trusted after this wait.
const APPOINTMENTS_MIN_SETTLE = 5_000;

class DashboardPage extends BasePage {
  constructor(page) {
    super(page);

    // Dashboard page title locator.
    this.pageTitle = "//h1[normalize-space()='Dashboard']";

    // Summary cards, appointment cards and the headings that scope them.
    this.cardBlock = this.page.locator('div[class*="rounded"][class*="border"]');
    this.funnelHeading = this.page.getByRole('heading', { name: 'Patient Journey Funnel' });
    this.appointmentsHeading = this.page.getByRole('heading', { name: "Today's Appointments" });
  }

  // Waits until the dashboard is visible after successful login.
  async waitForDashboard() {
    await allure.step('Wait for dashboard to load', async () => {
      await this.page.locator(this.pageTitle).waitFor({ state: 'visible', timeout: 15000 });
    });
  }

  // Gets the visible dashboard heading text.
  async getTitleText() {
    return await this.page.locator(this.pageTitle).textContent();
  }

  // Reads one summary card, for example "This Month 208 New Inquiry", into its
  // period, value and name. Values move every day, so callers assert on shape
  // and relationships rather than on the numbers themselves. The values render
  // a few seconds after the cards, so the card is polled until its number shows.
  async summaryStat(label) {
    let stat = null;

    await expect
      .poll(
        async () => {
          stat = await this.readSummaryStat(label);
          return stat ? 'ready' : 'waiting';
        },
        { timeout: 15_000, intervals: [500] },
      )
      .toBe('ready');

    return stat;
  }

  // One attempt at reading a summary card. Several blocks mention the same
  // label, so the one opening with a period and a number wins.
  async readSummaryStat(label) {
    const candidates = this.cardBlock.filter({ hasText: label });
    const count = await candidates.count();

    for (let index = 0; index < count; index += 1) {
      const text = ((await candidates.nth(index).innerText().catch(() => '')).replace(/\s+/g, ' ').trim());
      const match = text.match(/^(This Month|Today)\s+(\d+)\s+(.*)$/s);

      if (match && match[3].includes(label)) {
        return { period: match[1], value: Number(match[2]), name: match[3].trim() };
      }
    }

    return null;
  }

  // Reads the funnel stages in order, each with the patients it holds. Stage
  // blocks are the bordered blocks carrying a PATIENTS count. The counts render
  // after the shell, so an empty reading is retried instead of returned.
  async funnelStages() {
    let stages = [];

    await expect
      .poll(
        async () => {
          stages = await this.readFunnelStages();
          return stages.length;
        },
        { timeout: 15_000, intervals: [500] },
      )
      .toBeGreaterThan(0);

    return stages;
  }

  // One attempt at reading the funnel stages.
  async readFunnelStages() {
    const blocks = this.cardBlock.filter({ hasText: 'PATIENTS' });
    const count = await blocks.count();
    const stages = [];

    for (let index = 0; index < count; index += 1) {
      const text = (await blocks.nth(index).innerText()).replace(/\s+/g, ' ').trim();
      const match = text.match(/^(.*?)PATIENTS\s+(\d+)/);

      if (match) {
        stages.push({ name: match[1].trim(), patients: Number(match[2]) });
      }
    }

    return stages;
  }

  // A quick action link of the dashboard, matched by pattern because some names
  // carry a curly apostrophe.
  quickActionLink(pattern) {
    return this.page.getByRole('link', { name: pattern }).first();
  }

  // The View All entries of the dashboard in section order: daily account,
  // follow up, then today's appointments.
  viewAllLinks() {
    return this.page.getByText(/View All/);
  }

  // Switches the appointments widget to one of its type tabs.
  async selectAppointmentTab(name) {
    const before = (await this.appointmentCards()).join('|');

    await this.page.getByRole('button', { name, exact: true }).first().click();
    await this.waitForAppointmentsSettled(before);
  }

  // Waits until the appointment cards stop changing after a tab switch.
  async waitForAppointmentsSettled(before) {
    const startedAt = Date.now();
    let previous = null;
    let steadyReads = 0;

    await expect
      .poll(
        async () => {
          const key = (await this.appointmentCards()).join('|');

          if (before !== undefined && key !== before) {
            return true;
          }

          steadyReads = key === previous ? steadyReads + 1 : 0;
          previous = key;

          return steadyReads >= 2 && Date.now() - startedAt >= APPOINTMENTS_MIN_SETTLE;
        },
        { timeout: 20_000, intervals: [1_000] },
      )
      .toBe(true);
  }

  // The text of every appointment card, one entry per card. Each card carries
  // its own Call button, so the cards are reached through those buttons rather
  // than through markup that the layout is free to change.
  async appointmentCards() {
    return this.page.getByRole('button', { name: 'Call' }).evaluateAll((buttons) =>
      buttons.map((button) => {
        let node = button;

        for (let level = 0; level < 6 && node; level += 1) {
          node = node.parentElement;

          if (node && /rounded/.test(node.className) && node.innerText.length < 600) {
            return node.innerText.replace(/\s+/g, ' ').trim();
          }
        }

        return '';
      }),
    );
  }
}

module.exports = { DashboardPage };
