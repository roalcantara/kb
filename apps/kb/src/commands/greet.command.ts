export const greet = (name: string, times = 1) => {
  return Array.from({ length: times }, () => `Hello "${name}" via Bun!`).join("\n\n");
};