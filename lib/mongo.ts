import { MongoClient, Db, Collection } from "mongodb";

const g = globalThis as unknown as {
  __mongoClient?: Promise<MongoClient>;
  __mongoIndexes?: Promise<void>;
};

function getClient(): Promise<MongoClient> {
  if (!g.__mongoClient) {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("MONGODB_URI is not set");
    g.__mongoClient = new MongoClient(uri).connect();
  }
  return g.__mongoClient;
}

export interface ServiceReport {
  service_id: number;
  workshop_id: number;
  vehicle_id: number;
  vehicle_type: string;
  // Different vehicle types record different checks - this is why a document store fits.
  checks: Record<string, string | number | boolean>;
  condition_score: number; // 1 (poor) .. 10 (excellent)
  issues: string[];
  notes: string;
  created_at: Date;
}

export async function reports(): Promise<Collection<ServiceReport>> {
  const client = await getClient();
  const db: Db = client.db(process.env.MONGODB_DB || "garagebook");
  const col = db.collection<ServiceReport>("service_reports");
  if (!g.__mongoIndexes) {
    g.__mongoIndexes = (async () => {
      await col.createIndex({ service_id: 1 }, { unique: true });
      await col.createIndex({ vehicle_type: 1, created_at: -1 });
      await col.createIndex({ workshop_id: 1, created_at: -1 });
      await col.createIndex({ issues: 1 });
    })();
  }
  await g.__mongoIndexes;
  return col;
}
