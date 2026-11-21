import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';

// Firestore-like document store on Supabase (table: public.pb_docs).
// Keeps the existing call sites unchanged while removing the Firestore dependency.

 
type StoreData = Record<string, any>;

export class StoreTimestamp {
  private readonly ms: number;
  constructor(ms: number) {
    this.ms = ms;
  }
  toMillis() {
    return this.ms;
  }
  toDate() {
    return new Date(this.ms);
  }
  valueOf() {
    return this.ms;
  }
  toJSON() {
    return { __ts: this.ms };
  }
}

const isTimestamp = (value: unknown): value is { toMillis: () => number } =>
  !!value && typeof value === 'object' && typeof (value as { toMillis?: unknown }).toMillis === 'function';

function serialize(value: unknown): unknown {
  if (value === undefined) return null;
  if (isTimestamp(value)) return { __ts: value.toMillis() };
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === 'object') {
    const out: StoreData = {};
    for (const [key, item] of Object.entries(value as StoreData)) out[key] = serialize(item);
    return out;
  }
  return value;
}

function revive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(revive);
  if (value && typeof value === 'object') {
    const obj = value as StoreData;
    if (typeof obj.__ts === 'number') return new StoreTimestamp(obj.__ts);
    const out: StoreData = {};
    for (const [key, item] of Object.entries(obj)) out[key] = revive(item);
    return out;
  }
  return value;
}

function makeId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `id_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export const db = { kind: 'store' } as const;

export interface CollectionRef {
  kind: 'coll';
  coll: string;
}
export interface DocRef {
  kind: 'doc';
  coll: string;
  id: string;
}
export interface QueryRef {
  kind: 'query';
  coll: string;
  filters: Array<[string, unknown]>;
}

export function collection(_db: unknown, coll: string): CollectionRef {
  return { kind: 'coll', coll };
}

export function doc(_dbOrColl: unknown, collOrId?: string, maybeId?: string): DocRef {
  if (typeof collOrId === 'string' && maybeId !== undefined) {
    return { kind: 'doc', coll: collOrId, id: maybeId };
  }
  const coll = (_dbOrColl as CollectionRef).coll;
  return { kind: 'doc', coll, id: makeId() };
}

export function where(field: string, _op: string, value: unknown) {
  return { field, value };
}

export function query(collRef: CollectionRef, ...filters: Array<{ field: string; value: unknown }>): QueryRef {
  return { kind: 'query', coll: collRef.coll, filters: filters.map((f) => [f.field, f.value]) };
}

export class DocumentSnapshot {
  readonly id: string;
  private readonly present: boolean;
  private readonly raw: StoreData | null;

  constructor(id: string, present: boolean, raw: StoreData | null) {
    this.id = id;
    this.present = present;
    this.raw = raw;
  }
  exists() {
    return this.present;
  }
  data(): StoreData {
    return this.raw ? (revive(this.raw) as StoreData) : {};
  }
}

export class QuerySnapshot {
  readonly docs: DocumentSnapshot[];
  constructor(docs: DocumentSnapshot[]) {
    this.docs = docs;
  }
  forEach(callback: (doc: DocumentSnapshot) => void) {
    this.docs.forEach(callback);
  }
}

export function serverTimestamp() {
  return new StoreTimestamp(Date.now());
}

const ARRAY_UNION = '__arrayUnion';

export function arrayUnion(...values: unknown[]) {
  return { [ARRAY_UNION]: values };
}

export async function getDoc(ref: DocRef): Promise<DocumentSnapshot> {
  const { data, error } = await supabase
    .from('pb_docs')
    .select('id,data')
    .eq('collection', ref.coll)
    .eq('id', ref.id)
    .maybeSingle();
  if (error) throw error;
  return new DocumentSnapshot(ref.id, !!data, (data?.data as StoreData) ?? null);
}

export async function setDoc(ref: DocRef, data: StoreData, options?: { merge?: boolean }) {
  const payload = serialize(data) as StoreData;
  const { error } = await supabase.rpc('pb_set', {
    p_coll: ref.coll,
    p_id: ref.id,
    p_data: payload,
    p_merge: options?.merge === true,
  });
  if (error) throw error;
}

export async function updateDoc(ref: DocRef, data: StoreData) {
  const patch: StoreData = {};
  const append: StoreData = {};

  for (const [key, value] of Object.entries(data)) {
    const unionValues = value && typeof value === 'object' ? (value as Record<string, unknown>)[ARRAY_UNION] : undefined;
    if (Array.isArray(unionValues)) {
      append[key] = serialize(unionValues[0]);
    } else {
      patch[key] = serialize(value);
    }
  }

  const { error } = await supabase.rpc('pb_patch', {
    p_coll: ref.coll,
    p_id: ref.id,
    p_patch: patch,
    p_append: append,
  });
  if (error) throw error;
}

export async function deleteDoc(ref: DocRef) {
  const { error } = await supabase.rpc('pb_delete', { p_coll: ref.coll, p_id: ref.id });
  if (error) throw error;
}

export async function addDoc(collRef: CollectionRef, data: StoreData) {
  const ref: DocRef = { kind: 'doc', coll: collRef.coll, id: makeId() };
  await setDoc(ref, data);
  return { id: ref.id };
}

export function onSnapshot(ref: DocRef, callback: (snap: DocumentSnapshot) => void, onError?: (e: unknown) => void): () => void;
export function onSnapshot(ref: QueryRef | CollectionRef, callback: (snap: QuerySnapshot) => void, onError?: (e: unknown) => void): () => void;
export function onSnapshot(
  ref: DocRef | QueryRef | CollectionRef,
   
  callback: (snap: any) => void,
  onError?: (e: unknown) => void,
): () => void {
  let active = true;
  let channel: RealtimeChannel | null = null;

  const load = async () => {
    try {
      if (ref.kind === 'doc') {
        const snap = await getDoc(ref);
        if (active) callback(snap);
      } else {
        const { data, error } = await supabase.from('pb_docs').select('id,data').eq('collection', ref.coll);
        if (error) throw error;
        const rows = (data ?? []) as Array<{ id: string; data: StoreData }>;
        const filters = ref.kind === 'query' ? ref.filters : [];
        const docs = rows
          .filter((row) => filters.every(([field, value]) => row.data[field] === value))
          .map((row) => new DocumentSnapshot(row.id, true, row.data));
        if (active) callback(new QuerySnapshot(docs));
      }
    } catch (e) {
      if (active) onError?.(e);
    }
  };

  void load();

  const filter = ref.kind === 'doc' ? `id=eq.${ref.id}` : `collection=eq.${ref.coll}`;
  const channelName = `pb_${ref.kind}_${ref.coll}_${ref.kind === 'doc' ? ref.id : 'all'}_${makeId()}`;

  channel = supabase
    .channel(channelName)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pb_docs', filter }, (payload) => {
      const event = payload as { eventType?: string; new?: { data?: StoreData } };
      if (ref.kind === 'doc' && event.eventType !== 'DELETE' && event.new?.data) {
        if (active) callback(new DocumentSnapshot(ref.id, true, event.new.data));
        return;
      }
      void load();
    })
    .subscribe();

  return () => {
    active = false;
    if (channel) void supabase.removeChannel(channel);
    channel = null;
  };
}
