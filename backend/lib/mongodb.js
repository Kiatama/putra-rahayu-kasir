import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI; // Akan diambil dari env Vercel
const options = {};

let client;
let clientPromise;

if (!process.env.MONGODB_URI) {
  throw new Error('Silakan tambahkan MONGODB_URI ke dalam environment variables Anda');
}

if (process.env.NODE_ENV === 'development') {
  // Saat development, gunakan variabel global agar koneksi tidak terputus saat hot-reload
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  // Saat di production (Vercel), lebih baik tidak menggunakan variabel global
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

export default clientPromise;
