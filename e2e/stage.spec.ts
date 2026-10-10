import { type Page, expect, test } from '@playwright/test';
import { collectConsoleErrors } from './game';

function logs(page: Page): string[] {
  const lines: string[] = [];
  page.on('console', (message) => lines.push(message.text()));
  return lines;
}

async function tap(page: Page, key: string): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(120);
  await page.keyboard.up(key);
  await page.waitForTimeout(120);
}

test.describe('stage picker', () => {
  test('shows a card per scene, the current one picked, and launches with Entrée', async ({
    page,
  }) => {
    const errors = collectConsoleErrors(page);
    const lines = logs(page);
    await page.goto('/dev/ui.html?stagepicker');

    const picker = page.getByRole('radiogroup', { name: 'Scènes' });
    await expect(picker.getByRole('radio')).toHaveCount(2);
    await expect(picker.getByRole('radio', { name: /Le Dome/ })).toBeChecked();
    await expect(picker.getByRole('radio', { name: /Main stage/ })).toContainText('145 BPM');
    await page.screenshot({
      path: '/tmp/claude-1000/-home-cdlr-dev-Ozoboom/c6c76ee2-b7ca-4cec-ae22-009a54f4b196/scratchpad/stage-picker.png',
    });

    await tap(page, 'ArrowLeft');
    expect(lines).toContain('[ui] onChooseStage main');
    await expect(picker.getByRole('radio', { name: /Main stage/ })).toBeChecked();

    await picker.getByRole('radio', { name: /Le Dome/ }).click();
    expect(lines).toContain('[ui] onChooseStage dome');

    await tap(page, 'Enter');
    expect(lines).toContain('[ui] onConfirmStage');
    expect(errors).toEqual([]);
  });

  test('goes back with Échap and with the button', async ({ page }) => {
    const lines = logs(page);
    await page.goto('/dev/ui.html?stagepicker');
    await tap(page, 'Escape');
    expect(lines).toContain('[ui] onLeaveStagePicker');

    await page.goto('/dev/ui.html?stagepicker');
    await page.getByRole('button', { name: 'Lancer le set' }).click();
    expect(lines).toContain('[ui] onConfirmStage');
  });
});

test.describe('stage in the lobby', () => {
  test('lets the host choose, with the mouse and the keyboard', async ({ page }) => {
    const lines = logs(page);
    await page.goto('/dev/ui.html?lobby=host');
    const stages = page.getByRole('radiogroup', { name: 'Scène' });
    await expect(stages.getByRole('radio', { name: /Le Dome/ })).toBeChecked();

    await stages.getByRole('radio', { name: /Main stage/ }).click();
    expect(lines).toContain('[ui] onChooseStage main');
    await expect(stages.getByRole('radio', { name: /Main stage/ })).toBeChecked();

    for (let row = 0; row < 3; row += 1) {
      await tap(page, 'ArrowDown');
    }
    await tap(page, 'ArrowRight');
    expect(lines).toContain('[ui] onChooseStage dome');
  });

  test('shows a guest the host choice, read only', async ({ page }) => {
    const lines = logs(page);
    await page.goto('/dev/ui.html?lobby=guest');
    const lobby = page.getByRole('region', { name: 'Salon' });
    await expect(lobby).toContainText('L’hôte choisit la scène');
    const stages = lobby.getByRole('radiogroup');
    await expect(stages).toHaveAttribute('aria-readonly', 'true');
    await expect(stages.getByRole('radio', { name: /Le Dome/ })).toBeChecked();

    await stages.getByRole('radio', { name: /Main stage/ }).click();
    expect(lines.filter((line) => line.includes('onChooseStage'))).toEqual([]);
  });
});
