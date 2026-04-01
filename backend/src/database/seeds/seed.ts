import { DataSource } from 'typeorm';
import { Store } from '../../entities/store.entity';
import { Product } from '../../entities/product.entity';
import { Event, EventType } from '../../entities/event.entity';
import { User } from '../../entities/user.entity';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import 'dotenv/config';

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  username: process.env.DATABASE_USER || 'amboras',
  password: process.env.DATABASE_PASSWORD || 'amboras_dev',
  database: process.env.DATABASE_NAME || 'amboras_analytics',
  entities: [Store, Product, Event, User],
  synchronize: true,
});

const STORES = [
  { name: 'TechGear Pro', slug: 'techgear-pro' },
  { name: 'Fashion Hub', slug: 'fashion-hub' },
  { name: 'Home Essentials', slug: 'home-essentials' },
];

const PRODUCT_NAMES: Record<string, string[]> = {
  'techgear-pro': [
    'Wireless Earbuds', 'Mechanical Keyboard', 'Gaming Mouse', 'USB-C Hub', '4K Monitor',
    'Laptop Stand', 'Webcam HD', 'Portable SSD', 'Smart Watch', 'Bluetooth Speaker',
    'Phone Case', 'Screen Protector', 'Charging Cable', 'Power Bank', 'Mouse Pad',
    'Headphone Stand', 'Cable Organizer', 'Desk Lamp', 'Microphone', 'Ring Light',
  ],
  'fashion-hub': [
    'Classic T-Shirt', 'Slim Jeans', 'Running Shoes', 'Leather Belt', 'Sunglasses',
    'Canvas Backpack', 'Cotton Hoodie', 'Wool Scarf', 'Baseball Cap', 'Dress Shirt',
    'Denim Jacket', 'Linen Pants', 'Sneakers', 'Watch', 'Wallet',
    'Crossbody Bag', 'Beanie', 'Polo Shirt', 'Swim Trunks', 'Rain Jacket',
  ],
  'home-essentials': [
    'Coffee Maker', 'Toaster', 'Blender', 'Air Fryer', 'Rice Cooker',
    'Vacuum Cleaner', 'Desk Organizer', 'Plant Pot', 'Throw Blanket', 'Scented Candle',
    'Water Bottle', 'Cutting Board', 'Pan Set', 'Knife Set', 'Storage Bins',
    'Towel Set', 'Pillow', 'Door Mat', 'Wall Clock', 'Photo Frame',
  ],
};

const EVENT_WEIGHTS: [EventType, number][] = [
  [EventType.PAGE_VIEW, 0.60],
  [EventType.ADD_TO_CART, 0.20],
  [EventType.REMOVE_FROM_CART, 0.05],
  [EventType.CHECKOUT_STARTED, 0.10],
  [EventType.PURCHASE, 0.05],
];

function pickEventType(): EventType {
  const r = Math.random();
  let cumulative = 0;
  for (const [type, weight] of EVENT_WEIGHTS) {
    cumulative += weight;
    if (r <= cumulative) return type;
  }
  return EventType.PAGE_VIEW;
}

function randomPrice(): number {
  const prices = [9.99, 14.99, 19.99, 24.99, 29.99, 39.99, 49.99, 79.99, 99.99, 149.99, 199.99, 249.99, 349.99, 499.99];
  return prices[Math.floor(Math.random() * prices.length)];
}

async function seed() {
  await dataSource.initialize();
  console.log('Connected to database');

  const storeRepo = dataSource.getRepository(Store);
  const productRepo = dataSource.getRepository(Product);
  const eventRepo = dataSource.getRepository(Event);
  const userRepo = dataSource.getRepository(User);

  // Clear existing data
  await dataSource.query('DELETE FROM events');
  await dataSource.query('DELETE FROM users');
  await dataSource.query('DELETE FROM products');
  await dataSource.query('DELETE FROM stores');
  console.log('Cleared existing data');

  // Create stores
  const stores: Store[] = [];
  for (const s of STORES) {
    const store = storeRepo.create(s);
    await storeRepo.save(store);
    stores.push(store);
  }
  console.log(`Created ${stores.length} stores`);

  // Create products
  const allProducts: Map<string, Product[]> = new Map();
  for (const store of stores) {
    const products: Product[] = [];
    const names = PRODUCT_NAMES[store.slug] || PRODUCT_NAMES['techgear-pro'];
    for (const name of names) {
      const product = productRepo.create({
        store_id: store.id,
        name,
        price: randomPrice(),
      });
      await productRepo.save(product);
      products.push(product);
    }
    allProducts.set(store.id, products);
  }
  console.log('Created 20 products per store');

  // Create users (password: "password123" for all)
  const passwordHash = await bcrypt.hash('password123', 10);
  const userEmails = ['admin@techgear.com', 'admin@fashionhub.com', 'admin@homeessentials.com'];
  for (let i = 0; i < stores.length; i++) {
    const user = userRepo.create({
      email: userEmails[i],
      password_hash: passwordHash,
      name: `${stores[i].name} Admin`,
      store_id: stores[i].id,
    });
    await userRepo.save(user);
  }
  console.log('Created 1 user per store');

  // Generate 500K historical events over last 30 days
  const TOTAL_EVENTS = 500_000;
  const BATCH_SIZE = 5000;
  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

  console.log(`Generating ${TOTAL_EVENTS} events...`);

  for (let batch = 0; batch < TOTAL_EVENTS; batch += BATCH_SIZE) {
    const events: Partial<Event>[] = [];
    const batchEnd = Math.min(batch + BATCH_SIZE, TOTAL_EVENTS);

    for (let i = batch; i < batchEnd; i++) {
      const store = stores[Math.floor(Math.random() * stores.length)];
      const products = allProducts.get(store.id)!;
      const product = products[Math.floor(Math.random() * products.length)];
      const eventType = pickEventType();
      const timestamp = new Date(now - Math.random() * thirtyDaysMs);
      const sessionId = `sess_${randomUUID().slice(0, 8)}`;

      events.push({
        store_id: store.id,
        product_id: eventType === EventType.PAGE_VIEW && Math.random() < 0.3 ? undefined : product.id,
        event_type: eventType,
        revenue: eventType === EventType.PURCHASE ? product.price : undefined,
        session_id: sessionId,
        metadata: {},
        created_at: timestamp,
      });
    }

    await eventRepo
      .createQueryBuilder()
      .insert()
      .into(Event)
      .values(events)
      .execute();

    const progress = Math.round((batchEnd / TOTAL_EVENTS) * 100);
    process.stdout.write(`\rProgress: ${progress}% (${batchEnd}/${TOTAL_EVENTS})`);
  }

  console.log('\nEvents created');

  // Create materialized view
  await dataSource.query(`
    DROP MATERIALIZED VIEW IF EXISTS event_aggregates_hourly;
    CREATE MATERIALIZED VIEW event_aggregates_hourly AS
    SELECT
      store_id,
      event_type,
      date_trunc('hour', created_at) AS hour_bucket,
      COUNT(*) AS event_count,
      COALESCE(SUM(revenue), 0) AS total_revenue
    FROM events
    GROUP BY store_id, event_type, date_trunc('hour', created_at);

    CREATE UNIQUE INDEX ON event_aggregates_hourly (store_id, event_type, hour_bucket);
  `);
  console.log('Created materialized view');

  console.log('\nSeed complete!');
  console.log('Login credentials (all passwords: "password123"):');
  for (let i = 0; i < stores.length; i++) {
    console.log(`  ${stores[i].name}: ${userEmails[i]}`);
  }

  await dataSource.destroy();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
