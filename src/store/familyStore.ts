import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Person, Relationship, RelationshipType, Gender } from "@/types/family";

function uuid(): string {
  return crypto.randomUUID();
}

interface HistoryState {
  persons: Person[];
  relationships: Relationship[];
  rootPersonId: string | null;
  timestamp: number;
}

interface DataSnapshot {
  persons: Person[];
  relationships: Relationship[];
  rootPersonId: string | null;
  createdAt: string;
}

interface FamilyState {
  persons: Person[];
  relationships: Relationship[];
  rootPersonId: string | null;
  
  past: HistoryState[];
  future: HistoryState[];

  snapshots: DataSnapshot[];
  saveSnapshot: () => void;
  restoreSnapshot: (timestamp: string) => void;
  deleteSnapshot: (timestamp: string) => void;

  saveHistory: () => void;
  undo: () => void;
  redo: () => void;

  updatePerson: (id: string, data: Partial<Pick<Person, "full_name" | "gender" | "phone_number" | "birth_date">>) => void;
  addPerson: (data: { full_name: string; gender: Gender; phone_number?: string; birth_date?: string }) => Person;
  removePerson: (id: string) => void;
  removePersonRecursive: (id: string) => void;
  addRelationship: (type: RelationshipType, sourceId: string, targetId: string) => Relationship | null;
  countSpouses: (personId: string) => number;
  getPartner: (personId: string) => Person | null;
  getSpouses: (personId: string) => Person[];
  getSpouse: (personId: string) => Person | null;
  getChildren: (personId: string) => Person[];
  getParent: (personId: string) => Person | null;
  getSiblings: (personId: string) => Person[];
  getPerson: (id: string) => Person | undefined;
  hasRelationship: (type: RelationshipType, sourceId: string, targetId: string) => boolean;
  wouldCreateCycle: (parentId: string, childId: string) => boolean;
  reset: () => void;
  setRoot: (id: string) => void;
}

export const useFamilyStore = create<FamilyState>()(
  persist(
    (set, get) => ({
      persons: [],
      relationships: [],
      rootPersonId: null,
      past: [],
      future: [],
      snapshots: [],

      saveSnapshot: () => {
        const timestamp = new Date().toISOString();
        set((state) => ({
          snapshots: [
            ...state.snapshots,
            {
              persons: state.persons,
              relationships: state.relationships,
              rootPersonId: state.rootPersonId,
              createdAt: timestamp,
            },
          ],
        }));
      },

      restoreSnapshot: (timestamp: string) => {
        const snapshot = get().snapshots.find((s) => s.createdAt === timestamp);
        if (!snapshot) return;
        get().saveHistory();
        set({
          persons: snapshot.persons,
          relationships: snapshot.relationships,
          rootPersonId: snapshot.rootPersonId,
        });
      },

      deleteSnapshot: (timestamp: string) => {
        set((state) => ({
          snapshots: state.snapshots.filter((s) => s.createdAt !== timestamp),
        }));
      },

      saveHistory: () => {
        set((state) => ({
          past: [
            ...state.past,
            {
              persons: state.persons,
              relationships: state.relationships,
              rootPersonId: state.rootPersonId,
              timestamp: Date.now(),
            },
          ],
          future: [],
        }));
      },

      undo: () => {
        set((state) => {
          if (state.past.length === 0) return state;
          const previous = state.past[state.past.length - 1];
          const newPast = state.past.slice(0, -1);
          return {
            past: newPast,
            future: [
              {
                persons: state.persons,
                relationships: state.relationships,
                rootPersonId: state.rootPersonId,
                timestamp: Date.now(),
              },
              ...state.future,
            ],
            persons: previous.persons,
            relationships: previous.relationships,
            rootPersonId: previous.rootPersonId,
          };
        });
      },

      redo: () => {
        set((state) => {
          if (state.future.length === 0) return state;
          const next = state.future[0];
          const newFuture = state.future.slice(1);
          return {
            past: [
              ...state.past,
              {
                persons: state.persons,
                relationships: state.relationships,
                rootPersonId: state.rootPersonId,
                timestamp: Date.now(),
              },
            ],
            future: newFuture,
            persons: next.persons,
            relationships: next.relationships,
            rootPersonId: next.rootPersonId,
          };
        });
      },

      addPerson: (data) => {
        get().saveHistory();
        const person: Person = {
          id: uuid(),
          full_name: data.full_name,
          gender: data.gender,
          phone_number: data.phone_number || null,
          birth_date: data.birth_date || null,
          created_at: new Date().toISOString(),
        };
        set((state) => ({ persons: [...state.persons, person] }));
        return person;
      },

      updatePerson: (id, data) => {
        get().saveHistory();
        set((state) => ({
          persons: state.persons.map((p) =>
            p.id === id ? { ...p, ...data } : p
          ),
        }));
      },


      removePerson: (id) => {
        get().saveHistory();
        set((state) => ({
          persons: state.persons.filter((p) => p.id !== id),
          relationships: state.relationships.filter(
            (r) => r.source_person_id !== id && r.target_person_id !== id
          ),
          rootPersonId: state.rootPersonId === id ? null : state.rootPersonId,
        }));
      },

      removePersonRecursive: (id) => {
        get().saveHistory();
        const state = get();
        const toDelete = new Set<string>();
        const queue = [id];

        while (queue.length > 0) {
          const currentId = queue.shift()!;
          if (toDelete.has(currentId)) continue;
          toDelete.add(currentId);

          const childrenIds = state.relationships
            .filter((r) => r.type === "parent_child" && r.source_person_id === currentId)
            .map((r) => r.target_person_id);
          
          queue.push(...childrenIds);
        }

        set((state) => ({
          persons: state.persons.filter((p) => !toDelete.has(p.id)),
          relationships: state.relationships.filter(
            (r) => !toDelete.has(r.source_person_id) && !toDelete.has(r.target_person_id)
          ),
          rootPersonId: toDelete.has(state.rootPersonId!) ? null : state.rootPersonId,
        }));
      },

      addRelationship: (type, sourceId, targetId) => {
        const state = get();
        if (state.hasRelationship(type, sourceId, targetId)) return null;
        if (type === "parent_child" && state.wouldCreateCycle(sourceId, targetId)) return null;

        get().saveHistory();
        const rel: Relationship = {
          id: uuid(),
          type,
          source_person_id: sourceId,
          target_person_id: targetId,
          created_at: new Date().toISOString(),
        };
        set((s) => ({ relationships: [...s.relationships, rel] }));
        return rel;
      },

      getPartner: (personId) => {
        const { relationships, persons } = get();
        const rel = relationships.find(
          (r) =>
            (r.type === "partner" || r.type === "spouse") &&
            (r.source_person_id === personId || r.target_person_id === personId)
        );
        if (!rel) return null;
        const partnerId =
          rel.source_person_id === personId ? rel.target_person_id : rel.source_person_id;
        return persons.find((p) => p.id === partnerId) || null;
      },

      getSpouses: (personId) => {
        const { relationships, persons } = get();
        const rels = relationships.filter(
          (r) =>
            (r.type === "spouse" || r.type === "partner") &&
            (r.source_person_id === personId || r.target_person_id === personId)
        );
        const spouseIds = rels.map(r => r.source_person_id === personId ? r.target_person_id : r.source_person_id);
        return persons.filter((p) => spouseIds.includes(p.id));
      },

      countSpouses: (personId) => {
        return get().getSpouses(personId).length;
      },

      getSpouse: (personId) => {
        const { relationships, persons } = get();
        const rel = relationships.find(
          (r) =>
            r.type === "spouse" &&
            (r.source_person_id === personId || r.target_person_id === personId)
        );
        if (!rel) return null;
        const partnerId =
          rel.source_person_id === personId ? rel.target_person_id : rel.source_person_id;
        return persons.find((p) => p.id === partnerId) || null;
      },

      getChildren: (personId) => {
        const { relationships, persons } = get();
        const childIds = relationships
          .filter((r) => r.type === "parent_child" && r.source_person_id === personId)
          .map((r) => r.target_person_id);
        return persons.filter((p) => childIds.includes(p.id));
      },

      getParent: (personId) => {
        const { relationships, persons } = get();
        const rel = relationships.find(
          (r) => r.type === "parent_child" && r.target_person_id === personId
        );
        if (!rel) return null;
        return persons.find((p) => p.id === rel.source_person_id) || null;
      },

      getSiblings: (personId) => {
        const { relationships, persons } = get();
        // Explicit siblings
        const explicitSiblingIds = relationships
          .filter(
            (r) =>
              r.type === "sibling" &&
              (r.source_person_id === personId || r.target_person_id === personId)
          )
          .map((r) => (r.source_person_id === personId ? r.target_person_id : r.source_person_id));

        // Implicit siblings (shared parents)
        const parentIds = relationships
          .filter((r) => r.type === "parent_child" && r.target_person_id === personId)
          .map((r) => r.source_person_id);
        
        const implicitSiblingIds: string[] = [];
        for (const parentId of parentIds) {
          const siblings = relationships
            .filter(
              (r) =>
                r.type === "parent_child" &&
                r.source_person_id === parentId &&
                r.target_person_id !== personId
            )
            .map((r) => r.target_person_id);
          implicitSiblingIds.push(...siblings);
        }

        const allSiblingIds = Array.from(new Set([...explicitSiblingIds, ...implicitSiblingIds]));
        return persons.filter((p) => allSiblingIds.includes(p.id));
      },

      getPerson: (id) => get().persons.find((p) => p.id === id),

      hasRelationship: (type, sourceId, targetId) => {
        const isSymmetric = type === "spouse" || type === "sibling" || type === "partner";
        return get().relationships.some(
          (r) =>
            r.type === type &&
            ((r.source_person_id === sourceId && r.target_person_id === targetId) ||
              (isSymmetric && r.source_person_id === targetId && r.target_person_id === sourceId))
        );
      },

      wouldCreateCycle: (parentId, childId) => {
        const { relationships } = get();
        const visited = new Set<string>();
        const queue = [parentId];
        while (queue.length > 0) {
          const current = queue.shift()!;
          if (current === childId) continue;
          if (visited.has(current)) continue;
          visited.add(current);
          const parentRels = relationships.filter(
            (r) => r.type === "parent_child" && r.target_person_id === current
          );
          for (const r of parentRels) {
            if (r.source_person_id === childId) return true;
            queue.push(r.source_person_id);
          }
        }
        return false;
      },

      reset: () => {
        get().saveHistory();
        set({ persons: [], relationships: [], rootPersonId: null });
      },
      setRoot: (id) => {
        get().saveHistory();
        set({ rootPersonId: id });
      },
    }),
    {
      name: "family-quicktree-storage",
      partialize: (state) => ({
        persons: state.persons,
        relationships: state.relationships,
        rootPersonId: state.rootPersonId,
        snapshots: state.snapshots,
      }),
    }
  )
);
