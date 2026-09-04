// Ensures a user's existing department/station still shows up as a select
// option even if it was since renamed/removed from the lookup table.
export const optionsWithFallback = (items, currentValue) => {
  if (!currentValue || items.some((item) => item.name === currentValue)) {
    return items;
  }
  return [...items, { id: `current-${currentValue}`, name: currentValue }];
};
