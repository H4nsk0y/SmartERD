// frontend/features/support/state.ts

export type WorldState = {
  entities: any[];
  relations: any[];
  result?: any;
};

// начальное состояние
const state: WorldState = {
  entities: [],
  relations: [],
};

export default state;
