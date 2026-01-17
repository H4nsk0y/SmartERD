// frontend/cucumber.mjs
export default {
  paths: ["features/**/*.feature"],
  import: [
    "features/step_definitions/**/*.ts",
    "features/support/**/*.ts"
  ],
  publishQuiet: true,
  format: ["progress", "summary"]
};
