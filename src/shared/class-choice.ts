export function isFreeClass(
  classIds: readonly string[],
  taken: ReadonlySet<string>,
  classId: string,
): boolean {
  return classIds.includes(classId) && !taken.has(classId);
}

// Two players of a game never have the same class: a taken one gives way to the first one left.
export function freeClassId(
  classIds: readonly string[],
  taken: ReadonlySet<string>,
  wanted: string,
): string {
  if (isFreeClass(classIds, taken, wanted)) {
    return wanted;
  }
  return classIds.find((id) => !taken.has(id)) ?? wanted;
}
