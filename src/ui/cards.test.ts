import { describe, expect, it } from 'vitest';
import type { UpgradeOffer } from '../sim/state';
import { cardFor, cardName, dealOf, offerHeading, offerKicker, pickOf, waitingFor } from './cards';
import { UI_FIXTURE_CONTENT, fixturePlayer } from './fixtures';

const LEVEL_UP: UpgradeOffer = { playerId: 0, options: [], rarities: [] };
const RELICS: UpgradeOffer = { playerId: 0, options: [], rarities: [], kind: 'relic' };

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

    expect(card).toMatchObject({
      kind: 'weapon',
      rank: 'Niveau 3',
      pearls: { rank: 3, max: 5, label: 'Niveau 3 sur 5' },
    });
  });

  it('counts the pearls of an upgrade from the ranks held to its maximum', () => {
    const player = fixturePlayer({ upgrades: ['baskets-de-feu'] });

    const held = cardFor('baskets-de-feu', LEVEL_UP, player, UI_FIXTURE_CONTENT);
    const fresh = cardFor(
      'baskets-de-feu',
      LEVEL_UP,
      fixturePlayer({ upgrades: [] }),
      UI_FIXTURE_CONTENT,
    );

    expect(held.kind === 'upgrade' && held.pearls).toEqual({
      rank: 2,
      max: 5,
      label: 'Rang 2 sur 5',
    });
    expect(held).toMatchObject({ rank: 'Rang 2' });
    expect(fresh.kind === 'upgrade' && fresh.pearls).toEqual({
      rank: 1,
      max: 5,
      label: 'Rang 1 sur 5',
    });
    expect(fresh).toMatchObject({ rank: 'Nouveau' });
  });

  it('gives a relic no pearl', () => {
    const card = cardFor('relique-casque', RELICS, fixturePlayer(), UI_FIXTURE_CONTENT);

    expect(card.kind === 'upgrade' && card.pearls).toBeNull();
  });

  it('names the rarity drawn for an upgrade and tells its form, and leaves a common one plain', () => {
    const offer: UpgradeOffer = {
      playerId: 0,
      options: ['baskets-de-feu', 'nova-elargie'],
      rarities: ['legendary', 'common'],
    };

    const legendary = cardFor('baskets-de-feu', offer, fixturePlayer(), UI_FIXTURE_CONTENT);
    const common = cardFor('nova-elargie', offer, fixturePlayer(), UI_FIXTURE_CONTENT);

    expect(legendary).toMatchObject({
      name: 'Baskets de feu',
      description: 'Tu fends la foule à toute allure.',
      tint: 'legendary',
      rarityLabel: 'Légendaire',
    });
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

describe('dealOf', () => {
  it('deals three cards 150 ms apart, in their order', () => {
    expect(dealOf(['common', 'common', 'common'])).toEqual([
      { index: 0, delayMs: 0, celebrated: null },
      { index: 1, delayMs: 150, celebrated: null },
      { index: 2, delayMs: 300, celebrated: null },
    ]);
  });

  it('keeps the rarest card for the end, a legendary after a rare', () => {
    const dealt = dealOf(['legendary', 'rare', 'common']);

    expect(dealt.map((card) => card.index)).toEqual([2, 1, 0]);
    expect(dealt.map((card) => card.celebrated)).toEqual([null, 'rare', 'legendary']);
    expect(dealt.map((card) => card.delayMs)).toEqual([0, 150, 300]);
  });

  it('fits four relics in the same 300 ms, none celebrated', () => {
    const dealt = dealOf(['relic', 'relic', 'relic', 'relic']);

    expect(dealt.map((card) => card.delayMs)).toEqual([0, 100, 200, 300]);
    expect(dealt.every((card) => card.celebrated === null)).toBe(true);
  });

  it('deals a lone card at once', () => {
    expect(dealOf(['fusion'])).toEqual([{ index: 0, delayMs: 0, celebrated: null }]);
  });
});

describe('pickOf', () => {
  it('reads the card taken from an upgrade, a weapon and a fusion', () => {
    expect(pickOf({ type: 'upgradeChosen', playerId: 1, upgradeId: 'nova-elargie' })).toEqual({
      playerId: 1,
      cardId: 'nova-elargie',
    });
    expect(pickOf({ type: 'weaponGained', playerId: 2, weaponId: 'diabolo' })).toEqual({
      playerId: 2,
      cardId: 'diabolo',
    });
    expect(
      pickOf({
        type: 'weaponEvolved',
        playerId: 0,
        weaponId: 'diabolo',
        resultId: 'pluie-de-diabolos',
      }),
    ).toEqual({ playerId: 0, cardId: 'pluie-de-diabolos' });
  });

  it('ignores every other event', () => {
    expect(pickOf({ type: 'levelUp', playerId: 0, level: 2 })).toBeNull();
  });
});

describe('cardName', () => {
  it('names an upgrade and a weapon', () => {
    expect(cardName('nova-elargie', UI_FIXTURE_CONTENT)).toBe('Nova XXL');
    expect(cardName('diabolo', UI_FIXTURE_CONTENT)).toBe('Diabolo');
  });
});

describe('waitingFor', () => {
  const ines = { name: 'Inès', classId: 'healer', picked: null };
  const sam = { name: 'Sam', classId: 'tank', picked: null };
  const tom = { name: 'Tom', classId: 'mage', picked: null };

  it('says nothing when nobody else is choosing', () => {
    expect(waitingFor([], true)).toEqual({ chips: [], waiting: null });
  });

  it('tells who is choosing while this screen still chooses', () => {
    expect(waitingFor([ines, sam], false)).toEqual({
      chips: [
        { text: 'Inès choisit…', classId: null },
        { text: 'Sam choisit…', classId: null },
      ],
      waiting: null,
    });
  });

  it('tells who the set waits for once this screen has chosen', () => {
    expect(waitingFor([ines], true).waiting).toBe('En attente de Inès');
    expect(waitingFor([ines, sam, tom], true).waiting).toBe('En attente de Inès, Sam et Tom');
  });

  it('announces the card a friend took in the colour of their class, and stops waiting for them', () => {
    const waiting = waitingFor([{ ...ines, picked: 'Totem' }, sam], true);

    expect(waiting.chips).toEqual([
      { text: 'Inès : Totem', classId: 'healer' },
      { text: 'Sam choisit…', classId: null },
    ]);
    expect(waiting.waiting).toBe('En attente de Sam');
  });
});
