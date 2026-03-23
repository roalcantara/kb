export const greet = (name: string, times = 1) =>
  Array.from({ length: times }, () => `Hello "${name}" via Bun!`).join('\n\n')

console.log(greet('World'))
