const colorFormatter: (color: string) => number = color => {
  return parseInt(color.slice(1), 16)
}

export default colorFormatter
