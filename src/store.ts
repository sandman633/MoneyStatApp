import Dexie, { type Table } from "dexie";
import { initialState, validate, type State } from "./model";
class Database extends Dexie {
  data!: Table<{ key: string; value: State }, string>;
  constructor() {
    super("MoneyStat");
    this.version(1).stores({ data: "key" });
  }
}
export const db = new Database();
export async function load(): Promise<State> {
  return db.transaction("rw", db.data, async () => {
    let row = await db.data.get("state");
    if (!row) {
      row = { key: "state", value: initialState() };
      await db.data.put(row);
    }
    validate(row.value);
    return row.value;
  });
}
export async function change(update: (s: State) => void): Promise<State> {
  return db.transaction("rw", db.data, async () => {
    const row = await db.data.get("state");
    if (!row) throw Error("База ещё не готова.");
    update(row.value);
    validate(row.value);
    await db.data.put(row);
    return row.value;
  });
}
export async function restore(value: unknown): Promise<State> {
  validate(value as State);
  const state = value as State;
  await db.data.put({ key: "state", value: state });
  return state;
}
