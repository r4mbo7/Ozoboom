import type { Family, RenderContext } from './context';
import type { ClassDrawing } from './drawings';
import type { PoseOf } from './enemies';
import type { Face } from './face-kit';
import type { StageLook } from './ground';
import type { Tree } from './ground-layout';

export const FULL_LOOKS: readonly StageLook[] = [];
export const FULL_FACES: Readonly<Record<string, Face>> = {};
export const FULL_DRAWINGS: readonly ClassDrawing[] = [];
export const FULL_FAMILIES: readonly ((ctx: RenderContext, poseOf: PoseOf) => Family)[] = [];
export const FULL_CLEARINGS: Readonly<Record<string, readonly Tree[]>> = {};
