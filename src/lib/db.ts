import { MongoClient, type Db } from "mongodb"

if (!process.env.MONGODB_URI) {
  throw new Error("Please add your MongoDB URI to .env.local")
}

const uri = process.env.MONGODB_URI
const options = {}

let client: MongoClient
let clientPromise: Promise<MongoClient>
let db: Db

if (process.env.NODE_ENV === "development") {
  // In development mode, use a global variable so that the value
  // is preserved across module reloads caused by HMR (Hot Module Replacement).
  const globalWithMongo = global as typeof globalThis & {
    _mongoClientPromise?: Promise<MongoClient>
    _mongoDb?: Db
  }

  if (!globalWithMongo._mongoClientPromise) {
    client = new MongoClient(uri, options)
    globalWithMongo._mongoClientPromise = client.connect()
    globalWithMongo._mongoDb = client.db(process.env.MONGODB_DB || "synapse")
  }
  clientPromise = globalWithMongo._mongoClientPromise
  db = globalWithMongo._mongoDb as Db
} else {
  // In production mode, it's best to not use a global variable.
  client = new MongoClient(uri, options)
  clientPromise = client.connect()
  db = client.db(process.env.MONGODB_DB || "synapse")
}

export { clientPromise, db }

// Helper functions for common database operations
export async function findOne(collection: string, query: any) {
  return await db.collection(collection).findOne(query)
}

export async function findMany(collection: string, query: any, options = {}) {
  return await db.collection(collection).find(query, options).toArray()
}

export async function insertOne(collection: string, document: any) {
  return await db.collection(collection).insertOne(document)
}

export async function updateOne(collection: string, query: any, update: any) {
  return await db.collection(collection).updateOne(query, update)
}

export async function deleteOne(collection: string, query: any) {
  return await db.collection(collection).deleteOne(query)
}
