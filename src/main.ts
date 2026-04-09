import 'dotenv/config';
import { createApp } from './app';
import { connectDB, disconnectDB } from './infrastructure/persistence/connection';

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/car-repair-shop';

async function main(): Promise<void> {
  await connectDB(MONGODB_URI);
  const app = createApp();
  const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });

  process.on('SIGTERM', async () => {
    server.close();
    await disconnectDB();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
