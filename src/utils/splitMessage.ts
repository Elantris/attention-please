const splitMessage = (
  content: string,
  options?: {
    length?: number
    char?: string
  },
) => {
  const maxLength = options?.length || 2000
  const separator = options?.char || '\n'

  const results: string[] = []
  let chunk: string[] = []
  let currentChunkLength = 0

  content.split(separator).forEach(words => {
    if (currentChunkLength + words.length > maxLength) {
      results.push(chunk.join(separator))
      chunk = [words]
      currentChunkLength = words.length + separator.length
    } else {
      chunk.push(words)
      currentChunkLength += words.length + separator.length
    }
  })

  results.push(chunk.join(separator))

  return results
}

export default splitMessage
