import { type Page, expect as baseExpect, test } from '@playwright/test';
import { collectConsoleErrors } from './game';

test.describe.configure({ timeout: 120_000 });
const expect = baseExpect.configure({ timeout: 30_000 });

// Forces one cause of defeat on every frame until the sim calls the game lost: once is not
// enough, as the scene may repair itself or the player stand up before the sim checks the status.
async function loseBy(page: Page, cause: 'silence' | 'downed'): Promise<void> {
  await page.evaluate(
    (forced) =>
      new Promise<void>((resolve, reject) => {
        const force = () => {
          const state = window.ozoboom?.state;
          if (state === undefined) {
            reject(new Error('The game state is not exposed'));
          } else if (state.status === 'lost') {
            resolve();
          } else {
            if (forced === 'silence') {
              state.core.hp = 0;
            } else {
              state.players.forEach((player) => {
                player.downed = true;
              });
            }
            requestAnimationFrame(force);
          }
        };
        force();
      }),
    cause,
  );
}

async function startGame(page: Page): Promise<void> {
  await page.goto('./?dev=fast');
  await page.getByRole('button', { name: 'Jouer', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Pièges' })).toBeVisible();
}

test('blames the sound system when the scene goes silent', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await startGame(page);

  await loseBy(page, 'silence');

  const end = page.getByRole('region', { name: 'Fin de partie' });
  await expect(end.getByRole('heading', { name: 'La musique s’arrête' })).toBeVisible();
  await expect(end).toContainText('Les bad vibes ont eu raison du sound system.');
  expect(errors).toEqual([]);
});

test('tells of an empty dancefloor when the player is down and the scene still plays', async ({
  page,
}) => {
  const errors = collectConsoleErrors(page);
  await startGame(page);

  await loseBy(page, 'downed');

  const end = page.getByRole('region', { name: 'Fin de partie' });
  await expect(end.getByRole('heading', { name: 'Plus personne debout' })).toBeVisible();
  await expect(end).toContainText('Le sound system tient bon');
  await expect(end).not.toContainText('ont eu raison du sound system');
  expect(errors).toEqual([]);
});
