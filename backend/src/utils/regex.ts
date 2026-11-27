/** Case-insensitive "contains" matcher for user input; special characters are matched literally. */
export const containsRegex = (input: string): RegExp => new RegExp(input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
