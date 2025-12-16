module.exports = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow commented out code",
      category: "Style",
      recommended: false
    },
    fixable: "whitespace",
    schema: [],
    messages: {
      commentedOutCode: "Commented out code detected."
    }
  },
  create(context) {
    // Regex heuristics for common code patterns
    // We look for typical JS/TS keywords or syntax at start of comment lines
    const codePatterns = [
      /^\s*(?:const|let|var)\s+\w+\s*=/,
      /^\s*function\s+\w+/,
      /^\s*(?:class|interface|type)\s+\w+/,
      /^\s*(?:import|export)\s+/,
      /^\s*jest\.(?:mock|spyOn|fn)/,
      /^\s*console\.(?:log|error|warn|info|debug)/,
      /^\s*expect\(/,
      /^\s*describe\(/,
      /^\s*it\(/,
      /^\s*test\(/,
      /^\s*return\s+/
    ];

    return {
      Program() {
        const sourceCode = context.getSourceCode();
        const comments = sourceCode.getAllComments();

        comments.forEach((comment) => {
          // Check each line of the comment value
          const lines = comment.value.split("\n");

          for (const line of lines) {
            // Remove common comment prefixes if present in block comments, e.g. " * "
            // But usually getAllComments().value returns just the content.
            // For block comment "/*\n * code\n */", value is "\n * code\n ".

            // Clean up the line for checking
            // Remove leading asterisks which are common in JSDoc style block comments
            const cleanLine = line.replace(/^\s*\*\s?/, "");

            if (codePatterns.some((pattern) => pattern.test(cleanLine))) {
              context.report({
                node: comment,
                messageId: "commentedOutCode",
                fix(fixer) {
                  return fixer.remove(comment);
                }
              });
              // Report only once per comment block
              return;
            }
          }
        });
      }
    };
  }
};
