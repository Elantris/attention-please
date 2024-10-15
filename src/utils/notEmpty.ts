const notEmpty = <T>(item: T | undefined | null): item is T => item !== undefined && item !== null

export default notEmpty
