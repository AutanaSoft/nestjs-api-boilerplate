export default {
  '{src,test}/**/*.{js,jsx,ts,tsx}': ['prettier --write', 'oxlint'],
  '*.{json,yml,yaml}': ['prettier --write'],
  '*.{md,mdx}': ['prettier --write', 'markdownlint-cli2'],
};
