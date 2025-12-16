const noDuplicateComments = require("./eslint-rules/no-duplicate-comments");
const noCommentedOutCode = require("./eslint-rules/no-commented-out-code");

module.exports = {
  "no-duplicate-comments": noDuplicateComments,
  "no-commented-out-code": noCommentedOutCode
};
