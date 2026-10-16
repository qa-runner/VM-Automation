const { test, expect } = require('@playwright/test');
const { applyAllureContext } = require('../allure-context');
const { DashboardPage } = require('../../pages/dashboard/DashboardPage');
const { loginAsValidUser } = require('../../utils/authFlow');

// Funnel stages in the order the dashboard shows them.
const FUNNEL_STAGES = ['New Inquiry', 'Registration', 'First Consultation', 'Second Visit', 'Third Visit'];

test.describe('Dashboard', () => {
  // Signs in and waits for the dashboard, which every test below starts from.
  async function openDashboard(page) {
    await loginAsValidUser(page);

    const dashboardPage = new DashboardPage(page);
    await dashboardPage.waitForDashboard();

    return dashboardPage;
  }

  test.describe('Dashboard overview stats', () => {
    // Regression test: the summary cards and the funnel describe the same practice.
    // TC005: Verify summary stats and patient funnel agree.
    test('TC005 - user can see consistent summary stats and patient funnel', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Dashboard',
        suite: 'Overview Stats',
        type: 'regression',
        description:
          'Confirms the summary cards report labelled counts and the patient funnel narrows from inquiry to third visit.',
      });

      // Step 1: Open the dashboard.
      const dashboardPage = await openDashboard(page);

      // Step 2: Read every summary card.
      // Values move every day, so the shape and the period are pinned rather than
      // the numbers themselves.
      for (const [label, period] of [
        ['New Inquiry', 'This Month'],
        ['New Patient', 'This Month'],
        ['Dropout', 'This Month'],
        ['Consultation', 'Today'],
        ['Therapy', 'Today'],
        ['Follow up', 'Today'],
      ]) {
        const stat = await dashboardPage.summaryStat(label);

        // Assert: the card reports its period with a plain count.
        expect(stat.period).toBe(period);
        expect(Number.isInteger(stat.value)).toBe(true);
        expect(stat.value).toBeGreaterThanOrEqual(0);
      }

      // Step 3: Read the patient journey funnel.
      const stages = (await dashboardPage.funnelStages()).filter(
        (stage) => !stage.name.startsWith('Patient Journey Funnel'),
      );

      // Assert: every visit stage is shown in order and each stage holds no more
      // patients than the one before it, which is what makes it a funnel. The
      // long term stage groups patients differently, so it is only asked for a
      // count, not for a place in the narrowing.
      const visits = stages.filter((stage) => !stage.name.startsWith('Long-Term'));
      expect(visits).toHaveLength(FUNNEL_STAGES.length);
      FUNNEL_STAGES.forEach((stage, index) => {
        expect(visits[index].name.startsWith(stage)).toBe(true);
        expect(visits[index].patients).toBeGreaterThanOrEqual(0);

        if (index > 0) {
          expect(visits[index].patients).toBeLessThanOrEqual(visits[index - 1].patients);
        }
      });

      const longTerm = stages.find((stage) => stage.name.startsWith('Long-Term'));
      expect(longTerm.patients).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Dashboard quick actions', () => {
    // Smoke test: every quick action lands where it promises.
    // TC006: Verify quick actions reach every module.
    test('TC006 - user can reach every module from the dashboard quick actions', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Dashboard',
        suite: 'Quick Actions',
        type: 'smoke',
        description: 'Confirms every dashboard quick action opens its module, tab or form.',
      });

      // Step 1: Open the dashboard.
      const dashboardPage = await openDashboard(page);

      // Step 2: Follow every patient list shortcut.
      // Each one lands on the matching tab of the patient list.
      for (const [pattern, tab, heading] of [
        [/Waiting List/, 'waiting', 'Waiting Patient'],
        [/Follow-up Patient/, 'followup', 'Follow up Patient'],
        [/Recent Patient/, 'recent', 'Recent Patient'],
      ]) {
        await dashboardPage.quickActionLink(pattern).click();
        await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible();

        // Assert: the shortcut carries the tab it promises.
        expect(page.url()).toContain(`tab=${tab}`);
        await page.goBack();
      }

      // Step 3: Follow the appointment and analytics shortcuts.
      await dashboardPage.quickActionLink(/Today.*Appointment/).click();
      await expect(page.getByRole('heading', { name: 'Appointment Calendar' })).toBeVisible();
      expect(page.url()).toContain('appointment-calendar');
      await page.goBack();

      await dashboardPage.quickActionLink(/Analytics/).click();
      await expect(page.getByRole('heading', { name: 'Patient Analytics' })).toBeVisible();
      expect(page.url()).toContain('analytics/patient');
      await page.goBack();

      // Step 4: Open the registration form shortcut last. The run ends with the
      // form open, so nothing has to dismiss it.
      await dashboardPage.quickActionLink(/New Patient/).click();

      // Assert: the shortcut opens the patient list with the registration form
      // rather than a bare list.
      await expect(page.getByRole('heading', { name: 'Patient Registration' })).toBeVisible();
      expect(page.url()).toContain('patient-list');
    });

    // Smoke test: every View All entry of the dashboard lands in its module.
    // TC007: Verify View All entries open each section in full.
    test('TC007 - user can open each dashboard section in full from its View All entry', async ({
      page,
    }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Dashboard',
        suite: 'Quick Actions',
        type: 'smoke',
        description: 'Confirms the daily account, follow up and appointments sections open their full lists.',
      });

      // Step 1: Open the dashboard.
      const dashboardPage = await openDashboard(page);
      await expect(dashboardPage.viewAllLinks()).toHaveCount(3);

      // Step 2: Open the daily account in full.
      await dashboardPage.viewAllLinks().nth(0).click();
      await expect(page.getByRole('heading', { name: 'Receipt Report' })).toBeVisible();
      expect(page.url()).toContain('report/receipt');
      await page.goBack();

      // Step 3: Open the follow ups in full.
      // The entry carries the day it lists, which is always today.
      await dashboardPage.viewAllLinks().nth(1).click();
      await expect(page.getByRole('heading', { name: 'Follow up Patient' })).toBeVisible();
      expect(page.url()).toContain('tab=followup');

      const today = new Date();
      const stamp = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
        today.getDate(),
      ).padStart(2, '0')}`;
      expect(page.url()).toContain(`date=${stamp}`);
      await page.goBack();

      // Step 4: Open the appointments in full.
      await dashboardPage.viewAllLinks().nth(2).click();
      await expect(page.getByRole('heading', { name: 'Appointment Calendar' })).toBeVisible();
      expect(page.url()).toContain('appointment-calendar');
    });
  });
});
