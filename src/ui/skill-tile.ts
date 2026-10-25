import type { SkillDefinition } from '../data/types';
import type { InputDevice } from '../input/intents';
import { t } from '../shared/i18n';
import type { PlayerState } from '../sim/state';
import { createSkillView } from './bracelet';
import { el, icon, keycap, setFlag, setText, setVar } from './dom';
import { skillCharge } from './hud-model';
import { skillIcon } from './icons';
import type { Prompts } from './prompts';

export interface SkillTile {
  readonly element: HTMLElement;
  build(skill: SkillDefinition, device: InputDevice): void;
  update(player: PlayerState, skill: SkillDefinition): void;
}

export function createSkillTile(prompts: Prompts): SkillTile {
  const element = el('section', 'ui-hud__skills');
  element.setAttribute('aria-label', t('Spéciale'));
  const view = createSkillView();
  view.root.dataset.touchControl = 'skill';
  element.append(view.root);

  return {
    element,
    build(skill, device) {
      const shown = prompts.for(device);
      view.glyph.replaceChildren(icon('ui-skill__icon', skillIcon(skill.effect)));
      const name = t('Spéciale');
      setText(view.name, name);
      view.root.title = t('{name} : {description}', { name, description: t(skill.description) });
      view.key.replaceChildren(keycap(shown.skill, shown.style));
    },
    update(player, skill) {
      const ready = player.skillCooldown <= 0;
      setVar(view.root, '--charge', String(skillCharge(player, skill)));
      setFlag(view.root, 'ready', ready);
      setText(view.status, ready ? t('Prête') : t('Recharge'));
    },
  };
}
