import type { Family, RenderContext } from './context';
import type { ClassDrawing } from './drawings';
import type { Face } from './face-kit';
import type { StageLook } from './ground';

export const FULL_LOOKS: readonly StageLook[] = [];
export const FULL_FACES: Readonly<Record<string, Face>> = {};
export const FULL_DRAWINGS: readonly ClassDrawing[] = [];
export const FULL_FAMILIES: readonly ((ctx: RenderContext) => Family)[] = [];
