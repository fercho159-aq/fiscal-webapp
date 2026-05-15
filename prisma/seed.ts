import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  if (!adminEmail) {
    console.log("⊘ SEED_ADMIN_EMAIL no configurado, saltando seed");
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (existing) {
    if (existing.role !== "ADMIN") {
      await prisma.user.update({ where: { id: existing.id }, data: { role: "ADMIN" } });
      console.log(`✓ usuario ${adminEmail} promovido a ADMIN`);
    } else {
      console.log(`✓ admin ${adminEmail} ya existe`);
    }
    return;
  }

  await prisma.user.create({
    data: {
      email: adminEmail,
      role: "ADMIN",
      emailVerified: new Date(),
    },
  });
  console.log(`✓ admin creado: ${adminEmail}`);
  console.log("  Inicia sesión vía magic link — la cuenta ya existe en DB.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
