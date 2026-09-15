export function shouldShowHomeSectionLoading({
  itemCount,
  isFestsLoading,
  isHomeAuxLoaded,
  hasError,
}) {
  return itemCount === 0
    && !hasError
    && (isFestsLoading || !isHomeAuxLoaded);
}
