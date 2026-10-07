import { describe, expect, it } from 'vitest';
import type { UpgradeOffer } from '../sim/state';
import { cardFor, offerHeading, offerKicker, waitingFor } from './cards';
import { UI_FIXTURE_CONTENT, fixturePlayer } from './fixtures';

const LEVEL_UP: UpgradeOffer = { playerId: 0, options: [] };
const RELICS: UpgradeOffer = { playerId: 0, options: [], kind: 'relic' };

describe('cardFor', () => {
  it('shows a circus weapon with the sixteenth notes it fires on', () => {
    const card = cardFor('baton-de-feu', LEVEL_UP, fixturePlayer(), UI_FIXTURE_CONTENT);

    expect(card).toMatchObject({ kind: 'weapon', rank: 'Nouveau', label: 'Agrès · La Luxiole' });
    expect(card.kind === 'weapon' && card.steps).toEqual(
      Array.from({ length: 16 }, (_, step) => step % 4 === 0),
    );
  });

  it('shows a continuous weapon as a full strip', () => {
    const card = cardFor('eventails-de-feu', LEVEL_UP, fixturePlayer(), UI_FIXTURE_CONTENT);

    expect(card.kind === 'weapon' && card.steps).toBe('continuous');
  });

  it('offers the next level of a held weapon', () => {
    const player = fixturePlayer({ weapons: [{ id: 'diabolo', level: 2, phase: 0 }] });

    const card = cardFor('diabolo', LEVEL_UP, player, UI_FIXTURE_CONTENT);

    expect(card).toMatchObject({ kind: 'weapon', rank: 'Niveau 3' });
  });

  it('names the rarity of a rare upgrade and leaves a common one plain', () => {
    const rare = cardFor('baskets-de-feu-rare', LEVEL_UP, fixturePlayer(), UI_FIXTURE_CONTENT);
    const common = cardFor('baskets-de-feu', LEVEL_UP, fixturePlayer(), UI_FIXTURE_CONTENT);

    expect(rare).toMatchObject({ tint: 'rare', rarityLabel: 'Rare' });
    expect(common).toMatchObject({ tint: 'common', rarityLabel: null });
  });

  it('tells a fusion as a back to back of a weapon and an upgrade', () => {
    const card = cardFor('pluie-de-diabolos', LEVEL_UP, fixturePlayer(), UI_FIXTURE_CONTENT);

    expect(card).toMatchObject({
      kind: 'fusion',
      name: 'Pluie de diabolos',
      recipe: 'Diabolo + Nova XXL',
    });
  });

  it('puts every card of a relic offer in gold', () => {
    const card = cardFor('relique-casque', RELICS, fixturePlayer(), UI_FIXTURE_CONTENT);

    expect(card).toMatchObject({ kind: 'upgrade', family: 'relic', tint: 'relic' });
  });

  it('fails loudly on an identifier that is neither an upgrade nor a weapon', () => {
    expect(() => cardFor('inconnu', LEVEL_UP, fixturePlayer(), UI_FIXTURE_CONTENT)).toThrow(
      'Unknown card "inconnu"',
    );
  });
});

describe('the title of an offer', () => {
  it('announces the relic a boss drops', () => {
    expect(offerHeading(RELICS)).toBe('Le boss lâche une relique');
    expect(offerKicker(RELICS, fixturePlayer())).toBe('Boss vaincu');
  });

  it('asks for the upgrade of a level', () => {
    expect(offerHeading(LEVEL_UP)).toBe('Choisis ton amélioration');
    expect(offerKicker(LEVEL_UP, fixturePlayer({ level: 5 }))).toBe('Niveau 5');
  });
});

describe('waitingFor', () => {
  it('says nothing when nobody else is choosing', () => {
    expect(waitingFor([], true)).toEqual({ choosing: [], waiting: null });
  });

  it('tells who is choosing while this screen still chooses', () => {
    expect(waitingFor(['Inès', 'Sam'], false)).toEqual({
      choosing: ['Inès choisit…', 'Sam choisit…'],
      waiting: null,
    });
  });

  it('tells who the set waits for once this screen has chosen', () => {
    expect(waitingFor(['Inès'], true).waiting).toBe('En attente de Inès');
    expect(waitingFor(['Inès', 'Sam', 'Tom'], true).waiting).toBe('En attente de Inès, Sam et Tom');
  });
});
