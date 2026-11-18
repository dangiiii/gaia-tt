import { MongoClient } from 'mongodb';

if (!process.env.MONGODB_URI) {
  if (process.env.NODE_ENV === 'development') {
    throw new Error('Please add your Mongo URI to .env.local');
  } else {
    console.warn('MongoDB URI not found during build process');
  }
}

const uri = process.env.MONGODB_URI || '';
const options = {};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === 'development') {
  // In development mode, use a global variable to preserve the value
  // across module reloads caused by HMR (Hot Module Replacement).
  const globalWithMongo = global as typeof globalThis & {
    _mongoClientPromise?: Promise<MongoClient>;
  };

  if (!globalWithMongo._mongoClientPromise && uri) {
    client = new MongoClient(uri, options);
    globalWithMongo._mongoClientPromise = client.connect();
  }
  clientPromise = globalWithMongo._mongoClientPromise || Promise.reject(new Error('MongoDB URI not available'));
} else {
  // In production mode, it's best to not use a global variable.
  if (uri) {
    client = new MongoClient(uri, options);
    clientPromise = client.connect();
  } else {
    clientPromise = Promise.reject(new Error('MongoDB URI not available'));
  }
}

export default clientPromise;