const notEmpty = <T>(item: T | undefined | null): item is T => {
  return item !== undefined && item !== null
}

export default notEmpty
