import mongoose from "mongoose";

export async function connectMongo(uri, dbName) {
  if (!uri) {
    console.warn("MONGODB_URI is not set. API project routes will return 503 until MongoDB is configured.");
    return;
  }
  await mongoose.connect(uri, { dbName });
  console.log("MongoDB connected");
}

export function mongoReady() {
  return mongoose.connection.readyState === 1;
}
