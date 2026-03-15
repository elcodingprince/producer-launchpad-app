const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const token = 'tok_dev_' + Math.random().toString(36).substring(2, 10);
  const randomId = Math.random().toString(36).substring(2, 10);
  
  const order = await prisma.order.create({
    data: {
      shop: 'producer-launchpad.myshopify.com',
      shopifyOrderId: `test_order_${randomId}`,
      orderNumber: '1055-TEST',
      deliveryAccess: {
        create: {
          shop: 'producer-launchpad.myshopify.com',
          customerEmail: 'customer@example.com',
          customerName: 'A$AP Rocky',
          downloadToken: token,
        },
      },
      items: {
        create: [
          {
            shopifyLineId: `test_line_${randomId}`,
            productId: '8880628318465', // Using the ID from your test products
            variantId: '47900713713921',
            beatTitle: 'Midnight Sky',
            licenseName: 'Basic License'
          }
        ]
      }
    }
  });

  console.log('\n--- PORTAL TEST GENERATED ! ---');
  console.log('Token created:', token);
}

main().catch(console.error).finally(() => prisma.$disconnect());
