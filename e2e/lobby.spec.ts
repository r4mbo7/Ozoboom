import { type Page, expect, test } from '@playwright/test';
import { collectConsoleErrors } from './game';

const LOBBY = '/dev/ui.html?lobby=';

function logs(page: Page): string[] {
  const lines: string[] = [];
  page.on('console', (message) => lines.push(message.text()));
  return lines;
}

// The harness reads the keys once per tick: hold each long enough to be seen by exactly one.
async function tap(page: Page, key: string): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(120);
  await page.keyboard.up(key);
  await page.waitForTimeout(120);
}

// A device first seen with a key held waits for its release: press until the gesture has had its effect.
async function tapUntil(page: Page, key: string, done: () => boolean): Promise<void> {
  await expect.poll(async () => (done() ? true : (await tap(page, key), done()))).toBe(true);
}

function lobbyOf(page: Page) {
  return page.getByRole('region', { name: 'Salon' });
}

test.describe('title', () => {
  test('picks the class beside Jouer, with the mouse and with left and right', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const lines = logs(page);
    await page.goto('/dev/ui.html?screen=title');

    const picker = page.getByRole('radiogroup', { name: 'Ta classe' });
    await expect(picker.getByRole('radio')).toHaveCount(3);
    await expect(picker.getByRole('radio', { name: 'La VJ' })).toBeChecked();
    await picker.getByRole('radio', { name: 'Le roadie' }).click();
    await expect(picker.getByRole('radio', { name: 'Le roadie' })).toBeChecked();
    await expect(picker).toContainText('Tank : tient la ligne');
    expect(lines).toContain('[ui] onChooseClass tank');

    await expect(picker).toHaveAttribute('aria-current', 'true');
    await tap(page, 'ArrowRight');
    await expect(picker.getByRole('radio', { name: 'Le care' })).toBeChecked();
    await tap(page, 'ArrowLeft');
    await tap(page, 'ArrowLeft');
    await expect(picker.getByRole('radio', { name: 'La VJ' })).toBeChecked();
    expect(lines).toContain('[ui] onChooseClass healer');
    expect(lines).toContain('[ui] onChooseClass mage');
    expect(errors).toEqual([]);
  });

  test('keeps Jouer a single gesture, and opens the lobby from Jouer à plusieurs', async ({
    page,
  }) => {
    const lines = logs(page);
    await page.goto('/dev/ui.html?screen=title');
    await page.getByRole('button', { name: 'Jouer à plusieurs' }).click();
    expect(lines).toContain('[ui] onPlayTogether');
    await expect(lobbyOf(page).getByRole('heading', { name: 'Salon local' })).toBeVisible();

    await page.goto('/dev/ui.html?screen=title');
    await page.getByRole('button', { name: 'Jouer', exact: true }).click();
    expect(lines).toContain('[ui] onStart');
  });
});

test.describe('local lobby', () => {
  test('renders four seats and sends every gesture with its seat', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const lines = logs(page);
    await page.goto(`${LOBBY}local-full`);

    const lobby = lobbyOf(page);
    await expect(lobby.getByRole('listitem')).toHaveCount(4);
    await expect(lobby).toContainText('Clavier et souris');
    await expect(lobby).toContainText('Manette 3');
    await expect(lobby).toContainText('Lance le set');

    const name = lobby.getByRole('textbox', { name: 'Nom du joueur 3' });
    await expect(name).toHaveValue('Léo');
    await name.fill('Un nom bien trop long');
    await expect(name).toHaveValue('Un nom bien ');
    expect(lines).toContain('[ui] onSeatName 2 Un nom bien');

    await lobby
      .getByRole('listitem')
      .nth(1)
      .getByRole('button', { name: 'Classe suivante' })
      .click();
    expect(lines).toContain('[ui] onSeatClass 1 healer');
    await lobby
      .getByRole('listitem')
      .nth(3)
      .getByRole('button', { name: 'Classe précédente' })
      .click();
    expect(lines).toContain('[ui] onSeatClass 3 healer');

    await lobby.getByRole('button', { name: 'Lancer le set' }).click();
    expect(lines).toContain('[ui] onLaunch');
    expect(errors).toEqual([]);
  });

  test('takes a seat with Entrée, leaves it with Échap, then leaves the lobby', async ({
    page,
  }) => {
    const lines = logs(page);
    await page.goto(`${LOBBY}local-empty`);
    const lobby = lobbyOf(page);
    await expect(
      lobby.getByRole('button', { name: 'Appuie sur Entrée ou sur A pour rejoindre' }),
    ).toHaveCount(4);

    await tap(page, 'Enter');
    expect(lines).toContain('[ui] onJoinSeat keyboardMouse');
    await expect(lobby.getByRole('textbox', { name: 'Nom du joueur 1' })).toHaveValue('Joueur 1');
    await expect(
      lobby.getByRole('button', { name: 'Appuie sur Entrée ou sur A pour rejoindre' }),
    ).toHaveCount(3);

    await tap(page, 'ArrowDown');
    await tap(page, 'ArrowRight');
    expect(lines).toContain('[ui] onSeatClass 0 tank');

    await tap(page, 'Escape');
    expect(lines).toContain('[ui] onLeaveSeat 0');
    await expect(
      lobby.getByRole('button', { name: 'Appuie sur Entrée ou sur A pour rejoindre' }),
    ).toHaveCount(4);

    await tap(page, 'Escape');
    expect(lines).toContain('[ui] onLeaveLobby');
    await expect(page.getByRole('region', { name: 'Écran titre' })).toBeVisible();
  });

  test('drives each seat by its own device', async ({ page }) => {
    const lines = logs(page);
    await page.goto(`${LOBBY}local-two`);

    await expect(lobbyOf(page).getByRole('textbox', { name: 'Nom du joueur 2' })).toBeVisible();
    await tap(page, 'ArrowDown');
    await tap(page, 'ArrowRight');
    expect(lines).toContain('[ui] onSeatClass 0 tank');

    await tap(page, 'KeyP');
    await tap(page, 'ArrowDown');
    await tap(page, 'ArrowLeft');
    expect(lines).toContain('[ui] onSeatClass 1 mage');
    expect(lines.filter((line) => line.startsWith('[ui] onSeatClass'))).toHaveLength(2);
  });

  test('lets the first player launch from their own seat', async ({ page }) => {
    const lines = logs(page);
    await page.goto(`${LOBBY}local-two`);
    await expect(lobbyOf(page).getByRole('textbox', { name: 'Nom du joueur 1' })).toBeVisible();
    await tap(page, 'ArrowUp');
    await tap(page, 'ArrowUp');
    await tap(page, 'Enter');
    expect(lines).toContain('[ui] onLaunch');
  });

  test('ignores the game keys while a name is typed', async ({ page }) => {
    const lines = logs(page);
    await page.goto(`${LOBBY}local-two`);
    const name = lobbyOf(page).getByRole('textbox', { name: 'Nom du joueur 1' });
    await expect(name).toBeVisible();

    await tap(page, 'Enter');
    await expect(name).toBeFocused();
    await page.keyboard.type('gpe  1');
    await expect(name).toHaveValue('gpe  1');
    expect(lines.filter((line) => /onSeatClass|onLeave|onLaunch/.test(line))).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(name).not.toBeFocused();
  });
});

test.describe('lobby devices and the way online', () => {
  test('lets each device without a seat take one under its own id', async ({ page }) => {
    const lines = logs(page);
    await page.goto(`${LOBBY}local-empty&devices`);
    await tapUntil(page, 'Enter', () => lines.includes('[ui] onJoinSeat keyboardMouse'));
    await tapUntil(page, 'KeyJ', () => lines.includes('[ui] onJoinSeat gamepad:1'));
    await expect(lobbyOf(page).getByRole('textbox', { name: 'Nom du joueur 2' })).toBeVisible();
  });

  test('goes online from the local lobby, with the mouse and with the keyboard', async ({
    page,
  }) => {
    const lines = logs(page);
    await page.goto(`${LOBBY}local-empty`);
    await lobbyOf(page).getByRole('button', { name: 'Jouer en ligne' }).click();
    expect(lines).toContain('[ui] onGoOnline');
    await expect(lobbyOf(page).getByRole('button', { name: 'Créer un salon' })).toBeVisible();

    await page.goto(`${LOBBY}local-two`);
    await expect(lobbyOf(page).getByRole('textbox', { name: 'Nom du joueur 1' })).toBeVisible();
    await tap(page, 'ArrowUp');
    await tap(page, 'Enter');
    expect(lines.filter((line) => line === '[ui] onGoOnline')).toHaveLength(2);
  });
});

test.describe('online lobby', () => {
  test('creates a room, and a pasted code with spaces and lowercase joins it', async ({ page }) => {
    const lines = logs(page);
    await page.goto(`${LOBBY}entry`);
    const lobby = lobbyOf(page);
    await expect(lobby.getByRole('heading', { name: 'Salon en ligne' })).toBeVisible();

    await lobby.getByRole('textbox', { name: 'Code du salon' }).fill('  k7m 2qx ');
    await expect(lobby.getByRole('textbox', { name: 'Code du salon' })).toHaveValue('K7M2QX');
    await lobby.getByRole('button', { name: 'Rejoindre' }).click();
    expect(lines).toContain('[ui] onJoinRoom K7M2QX');

    await page.goto(`${LOBBY}entry`);
    await lobbyOf(page).getByRole('button', { name: 'Créer un salon' }).click();
    expect(lines).toContain('[ui] onCreateRoom');
  });

  test('fills the code from the link', async ({ page }) => {
    await page.goto(`${LOBBY}entry#rejoindre=ab12cd`);
    await expect(lobbyOf(page).getByRole('textbox', { name: 'Code du salon' })).toHaveValue(
      'AB12CD',
    );
  });

  test('shows the host the code, the link and the remote seats, and copies the link', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto(`${LOBBY}host`);
    const lobby = lobbyOf(page);
    await expect(lobby.getByText('K7M2QX', { exact: true })).toBeVisible();
    await expect(lobby).toContainText('#rejoindre=K7M2QX');
    await expect(lobby.getByRole('listitem').nth(1)).toContainText('Camille');
    await expect(lobby.getByRole('listitem').nth(1)).toContainText('Le roadie');
    await expect(lobby.getByRole('listitem').nth(1).getByRole('textbox')).toBeHidden();
    await expect(lobby.getByRole('button', { name: 'Lancer le set' })).toBeVisible();

    await lobby.getByRole('button', { name: 'Copier le lien' }).click();
    await expect(lobby.getByRole('status')).toContainText('Lien copié');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/#rejoindre=K7M2QX$/);
  });

  test('selects the link when the clipboard is not there', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', { value: undefined });
    });
    await page.goto(`${LOBBY}host`);
    const lobby = lobbyOf(page);
    await lobby.getByRole('button', { name: 'Copier le lien' }).click();
    await expect(lobby.getByRole('status')).toContainText('Lien sélectionné');
    expect(await page.evaluate(() => window.getSelection()?.toString())).toContain(
      '#rejoindre=K7M2QX',
    );
  });

  test('shows a guest their own seat and waits for the host', async ({ page }) => {
    const lines = logs(page);
    await page.goto(`${LOBBY}guest`);
    const lobby = lobbyOf(page);
    await expect(lobby.getByText('En attente de l’hôte')).toBeVisible();
    await expect(lobby.getByRole('button', { name: 'Lancer le set' })).toBeHidden();
    await expect(lobby.getByRole('textbox', { name: 'Nom du joueur 2' })).toHaveValue('Camille');
    await expect(lobby.getByRole('textbox', { name: 'Nom du joueur 1' })).toBeHidden();

    await lobby.getByRole('button', { name: 'Classe suivante' }).click();
    expect(lines).toContain('[ui] onSeatClass 1 healer');
    await lobby.getByRole('button', { name: 'Quitter le salon' }).click();
    expect(lines).toContain('[ui] onLeaveLobby');
  });

  test('walks the room with the keyboard', async ({ page }) => {
    const lines = logs(page);
    await page.goto(`${LOBBY}host`);
    const lobby = lobbyOf(page);
    await expect(lobby.getByRole('button', { name: 'Copier le lien' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    await tap(page, 'ArrowDown');
    await tap(page, 'ArrowDown');
    await tap(page, 'ArrowRight');
    expect(lines).toContain('[ui] onSeatClass 0 tank');
    await tap(page, 'ArrowDown');
    await expect(lobby.getByRole('button', { name: 'Lancer le set' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    await tap(page, 'Enter');
    expect(lines).toContain('[ui] onLaunch');
  });

  test('says each error plainly', async ({ page }) => {
    for (const [fixture, text] of [
      ['error-reload', 'Recharge la page'],
      ['error-full', 'Salon plein'],
      ['error-started', 'La partie a déjà commencé'],
      ['error-connection', 'Connexion impossible'],
    ] as const) {
      await page.goto(`${LOBBY}${fixture}`);
      await expect(lobbyOf(page).getByRole('alert')).toHaveText(text);
    }
  });
});
