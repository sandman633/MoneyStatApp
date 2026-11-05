export type EntryKind = "expense" | "income";

export interface CatalogAccount {
  id: string;
  name: string;
  currency: string;
}

export interface CatalogCategory {
  id: string;
  name: string;
  kind: EntryKind;
}

export interface Catalog {
  accounts: CatalogAccount[];
  categories: CatalogCategory[];
  currencies: string[];
}

export interface StoredCatalog extends Catalog { revision: number }

export type WizardState =
  | { step: "idle" }
  | { step: "amount"; kind: EntryKind }
  | { step: "account"; kind: EntryKind; amount: number }
  | { step: "category"; kind: EntryKind; amount: number; accountId: string }
  | { step: "comment"; kind: EntryKind; amount: number; accountId: string; categoryId: string }
  | { step: "confirm"; kind: EntryKind; amount: number; accountId: string; categoryId: string; note: string };
