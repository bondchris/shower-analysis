module.exports = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow duplicate consecutive comments",
      category: "Style",
      recommended: false
    },
    fixable: "whitespace",
    schema: [], // no options
    messages: {
      duplicateComment: "Duplicate consecutive comment found."
    }
  },
  create(context) {
    return {
      Program() {
        const sourceCode = context.getSourceCode();
        const comments = sourceCode.getAllComments();

        for (let i = 0; i < comments.length - 1; i++) {
          const current = comments[i];
          const next = comments[i + 1];

          // Check if contents are identical
          if (current.value.trim() === next.value.trim()) {
            // Check if they are consecutive lines or same line
            // We only care if they are "consecutive" in a way that looks like duplication
            // Logic: if next comment starts on the line immediately after current ends, or same line.
            // But user example was:
            // // ChartUtils Mock
            // // ChartUtils Mock
            // So we want to catch that.

            const currentEndLine = current.loc.end.line;
            const nextStartLine = next.loc.start.line;

            // If they are adjacent (diff is 1) or same line (diff 0)
            // But we might want to ignore if there is code in between?
            // "getAllComments" returns all comments. If there is code in between, it's not really a duplicate comment block in the same sense, but effectively it IS a duplicate comment.
            // However, usually we care about accidental copy-paste like:
            // // TODO
            // // TODO
            // So enforcing no code in between is validation.

            const rangeBetween = [current.range[1], next.range[0]];
            const textBetween = sourceCode.text.slice(rangeBetween[0], rangeBetween[1]);

            // If text between contains only whitespace, they are consecutive.
            if (!textBetween.trim()) {
              context.report({
                node: next,
                messageId: "duplicateComment",
                fix(fixer) {
                  // Remove the second comment AND the whitespace before it (to avoid leaving empty lines)
                  // rangeBetween[0] is end of first comment. next.range[1] is end of second comment.
                  // Actually, if we just remove the node `next`, we might leave a newline.
                  // Ideally we want to remove from the end of the first comment to the end of the second comment?
                  // No, that would remove newline after first comment, merging them if they were on different lines?
                  // Let's just remove the `next` node. ESLint usually handles whitespace around deleted nodes if passing the node range?
                  // But `fixer.remove(next)` removes the range of the comment.
                  // If we have:
                  // // A\n// A
                  // Removing second `// A` leaves `// A\n`. This is fine.
                  // But if we have `// A // A` (same line), removing second one leaves `// A `.
                  // Let's stick to `fixer.remove(next)` for simplicity, or include the preceding whitespace if needed.
                  // If we include preceding whitespace, we might remove the newline of the FIRST comment, which is bad.
                  // So `fixer.remove(next)` is safest.

                  return fixer.remove(next);
                }
              });
            }
          }
        }
      }
    };
  }
};
