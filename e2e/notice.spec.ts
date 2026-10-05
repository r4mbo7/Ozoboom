import { expect, test } from '@playwright/test';
import { collectConsoleErrors } from './game';

test('shows an interruption over the game, and its button leaves for the title', async ({
  page,
}) => {
  const errors = collectConsoleErrors(page);
  const logs: string[] = [];
  page.on('console', (message) => logs.push(message.text()));
  await page.goto('/dev/ui.html?screen=game&notice=hostLeft');

  const notice = page.getByRole('region', { name: 'Interruption' });
  await expect(notice.getByRole('heading', { name: 'L’hôte a quitté le set' })).toBeVisible();
  await expect(notice).toContainText('Sans lui, le sound system s’éteint.');
  await notice.getByRole('button', { name: 'Retour au titre' }).click();

  await expect(page.getByRole('region', { name: 'Écran titre' })).toBeVisible();
  expect(logs).toContain('[ui] onLeaveNotice');
  expect(errors).toEqual([]);
});

test('shows the lobby with a way back', async ({ page }) => {
  await page.goto('/dev/ui.html?lobby');

  const lobby = page.getByRole('region', { name: 'Salon' });
  await expect(lobby.getByRole('heading', { name: 'Salon local' })).toBeVisible();
  await lobby.getByRole('button', { name: 'Retour au titre' }).click();

  await expect(page.getByRole('region', { name: 'Écran titre' })).toBeVisible();
});
