// frontend/features/support/hooks.ts
import { Before } from "@cucumber/cucumber";
import state from "./state";

Before(() => {
  state.entities = [];
  state.relations = [];
  state.result = undefined;
});
