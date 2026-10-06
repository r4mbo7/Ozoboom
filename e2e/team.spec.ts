import { type Locator, type Page, expect, test } from '@playwright/test';
import { collectConsoleErrors, repeatUntil } from './game';

function logsOf(page: Page): string[] {
  const logs: string[] = [];
  page.on('console', (message) => logs.push(message.text()));
  return logs;
}

async function currentIndex(cards: Locator): Promise<number> {
  return cards.evaluateAll((nodes) =>
    nodes.findIndex((node) => node.getAttribute('aria-current') === 'true'),
  );
}

// A menu ignores presses for a moment after it opens: press again until the selection moves.
async function moveTo(page: Page, key: string, cards: Locator, index: number): Promise<void> {
  await repeatUntil(
    async () => {
      if ((await currentIndex(cards)) !== index) {
        await page.keyboard.press(key);
      }
    },
    async () => (await currentIndex(cards)) === index,
  );
}

test.describe('the HUD of a team', () => {
  test('shows a band per player of the screen and a compact one for the others', async ({
    page,
  }) => {
    const errors = collectConsoleErrors(page);
    await page.goto('/dev/ui.html?screen=team');

    const bands = page.locator('.ui-band:not(.ui-band--compact)');
    await expect(bands).toHaveCount(2);
    await expect(bands.nth(0)).toContainText('Léa');
    await expect(bands.nth(0)).toContainText('La VJ');
    await expect(bands.nth(0)).toContainText('82 / 100');
    await expect(bands.nth(0)).toContainText('Niv. 6');
    await expect(bands.nth(1)).toContainText('Tom');
    await expect(bands.nth(1)).toContainText('Le roadie');
    const others = page.locator('.ui-band--compact');
    await expect(others).toHaveCount(2);
    await expect(others.nth(0)).toContainText('Inès');
    await expect(others.nth(1)).toContainText('Sam');
    await expect(others.nth(1)).toContainText('À terre');
    await expect(others.nth(0)).not.toContainText('À terre');
    await expect(page.getByRole('region', { name: 'Pièges' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Niveau' })).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('shows the weapons of each player in their band, and the full panel for a single one', async ({
    page,
  }) => {
    await page.goto('/dev/ui.html?screen=team&locals=2');

    const bands = page.locator('.ui-band:not(.ui-band--compact)');
    await expect(bands.nth(0).getByRole('img', { name: 'Bâton de feu, niveau 3' })).toBeVisible();
    await expect(bands.nth(0).getByRole('img', { name: 'Diabolo, niveau 1' })).toBeVisible();
    await expect(
      bands.nth(1).getByRole('img', { name: 'Éventails de feu, niveau 2' }),
    ).toBeVisible();
    await expect(page.getByRole('region', { name: 'Agrès' })).toBeHidden();

    await page.goto('/dev/ui.html?screen=team&locals=1');
    await expect(page.getByRole('region', { name: 'Agrès' })).toBeVisible();
    await expect(page.locator('.ui-band__weapon:visible')).toHaveCount(0);
  });

  test('shows each band the prompts of the device of its player', async ({ page }) => {
    await page.goto('/dev/ui.html?screen=team&locals=3&pads=2');

    const keys = page.locator('.ui-band:not(.ui-band--compact)').locator('.ui-skill__key');
    await expect(keys).toHaveText(['E', 'LT', 'LT']);
  });

  test('keeps the traps on the bottom edge, below the bands, when several players share the screen', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/dev/ui.html?screen=team&locals=4');

    const traps = await page.getByRole('region', { name: 'Pièges' }).boundingBox();
    const band = await page.locator('.ui-band').first().boundingBox();
    if (traps === null || band === null) {
      throw new Error('expected the traps and a band on screen');
    }
    expect(traps.y).toBeGreaterThan(band.y + band.height);
    expect(traps.y + traps.height).toBeGreaterThan(800 - 40);
    expect(band.height).toBeLessThan(125);
  });

  test('shows four full bands when four players sit at the screen', async ({ page }) => {
    await page.goto('/dev/ui.html?screen=team&locals=4');

    await expect(page.locator('.ui-band:not(.ui-band--compact)')).toHaveCount(4);
    await expect(page.locator('.ui-band--compact')).toHaveCount(0);
  });

  test('keeps the solo HUD when the sim holds one player', async ({ page }) => {
    await page.goto('/dev/ui.html?screen=game');

    await expect(page.getByRole('region', { name: 'Niveau' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Compétence' })).toBeVisible();
    await expect(page.locator('.ui-band')).toHaveCount(0);
    await expect(page.locator('.ui-hud')).not.toHaveAttribute('data-team', '');
  });
});

test.describe('offers side by side', () => {
  test('are navigated by their own player and do not interfere', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const logs = logsOf(page);
    await page.goto('/dev/ui.html?screen=offers');
    const panels = page.locator('.ui-offer:visible');
    await expect(panels).toHaveCount(2);
    await expect(panels.nth(0)).toContainText('Léa');
    await expect(panels.nth(1)).toContainText('Tom');
    const first = panels.nth(0).getByRole('button');
    const second = panels.nth(1).getByRole('button');

    await moveTo(page, 'ArrowRight', first, 1);
    expect(await currentIndex(second)).toBe(0);
    await moveTo(page, 'KeyD', second, 2);
    expect(await currentIndex(first)).toBe(1);

    await page.keyboard.press('Enter');
    await expect(panels.nth(0)).toHaveAttribute('data-state', 'chosen');
    await expect(panels.nth(1)).toHaveAttribute('data-state', 'choosing');
    await expect(first.nth(1)).toContainText('Choisi');
    expect(await currentIndex(second)).toBe(2);
    expect(logs).toContain('[ui] onChooseUpgrade 0 baskets-de-feu-rare');
    expect(logs.filter((line) => line.startsWith('[ui] onChooseUpgrade'))).toHaveLength(1);
    expect(errors).toEqual([]);
  });

  test('tell who still chooses, then who the set waits for', async ({ page }) => {
    await page.goto('/dev/ui.html?screen=offers');
    const panels = page.locator('.ui-offer:visible');
    const status = page.locator('.ui-offers__wait');
    await expect(page.locator('.ui-offers__chip')).toHaveText(['Inès choisit…']);
    await expect(status).toBeHidden();

    await repeatUntil(
      async () => {
        await page.keyboard.press('Enter');
        await page.keyboard.press('Space');
      },
      async () =>
        (await panels.nth(0).getAttribute('data-state')) === 'chosen' &&
        (await panels.nth(1).getAttribute('data-state')) === 'chosen',
    );

    await expect(status).toHaveText('En attente de Inès');
    await expect(page.locator('.ui-offers__chip')).toHaveText(['Inès choisit…']);
  });

  test('stay a single panel, as before, for one player', async ({ page }) => {
    await page.goto('/dev/ui.html?screen=upgrade');

    await expect(page.locator('.ui-offer:visible')).toHaveCount(1);
    await expect(page.locator('.ui-offers__panels')).not.toHaveAttribute('data-multi', '');
    await expect(page.locator('.ui-who:visible')).toHaveCount(0);
    await expect(page.locator('.ui-offers__chip')).toHaveCount(0);
  });
});

test.describe('the end of a team', () => {
  test('lists who stands at sunrise, with the score of all', async ({ page }) => {
    await page.goto('/dev/ui.html?screen=teamWon');

    const team = page.getByRole('list', { name: 'L’équipe' });
    await expect(team.getByRole('listitem')).toHaveCount(4);
    await expect(team.getByRole('listitem').nth(0)).toContainText('Léa');
    await expect(team.getByRole('listitem').nth(0)).toContainText('La VJ');
    await expect(team.getByRole('listitem').nth(0)).toContainText('Debout');
    await expect(team.getByRole('listitem').nth(3)).toContainText('Sam');
    await expect(team.getByRole('listitem').nth(3)).toContainText('À terre');
    await expect(page.getByText('Score')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Rejouer' })).toBeVisible();
  });

  test('lets a guest wait for the host instead of restarting', async ({ page }) => {
    await page.goto('/dev/ui.html?screen=teamLost&role=guest');

    await expect(page.getByRole('button', { name: 'Rejouer' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Retour au titre' })).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Fin de partie' }).getByText('En attente de l’hôte'),
    ).toBeVisible();
  });

  test('has no team list for a solo game', async ({ page }) => {
    await page.goto('/dev/ui.html?screen=won');

    await expect(page.getByRole('list', { name: 'L’équipe' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Rejouer' })).toBeVisible();
  });
});

test.describe('interruptions', () => {
  test('a divergence carries its tick and offers the report', async ({ page }) => {
    const logs = logsOf(page);
    await page.goto(
      '/dev/ui.html?screen=team&notice=desync&details=' +
        encodeURIComponent('Tick 4812 · mesure 75'),
    );

    const notice = page.getByRole('region', { name: 'Interruption' });
    await expect(
      notice.getByRole('heading', { name: 'Les deux versions de la partie ont divergé' }),
    ).toBeVisible();
    await expect(notice).toContainText('Tick 4812 · mesure 75');
    await notice.getByRole('button', { name: /Ton avis/ }).click();
    expect(logs).toContain('[ui] onFeedback Tick 4812 · mesure 75');
  });

  test('the host leaving and a lost connection each have their words', async ({ page }) => {
    await page.goto('/dev/ui.html?screen=team&notice=hostLeft');
    await expect(page.getByRole('heading', { name: 'L’hôte a quitté le set' })).toBeVisible();

    await page.goto('/dev/ui.html?screen=team&notice=connectionLost');
    await expect(page.getByRole('heading', { name: 'Connexion perdue' })).toBeVisible();
  });
});
