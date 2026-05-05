import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const adminEmails = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

async function main() {
  await prisma.settings.upsert({
    where: { id: "default" },
    update: {
      maxBookingDurationMinutes: 480
    },
    create: {
      id: "default",
      externalHourlyRateCents: 1800,
      openingHour: 8,
      closingHour: 21,
      slotDurationMinutes: 30,
      maxBookingDurationMinutes: 480,
      cancellationRules: "Kostenfreie Stornierung bis 24 Stunden vor Spielbeginn."
    }
  });

  for (const name of ["Platz 1", "Platz 2", "Platz 3", "Platz 4"]) {
    await prisma.court.upsert({
      where: { name },
      update: {},
      create: {
        name,
        isActive: true,
        notes: name === "Platz 4" ? "Flutlichtplatz" : null
      }
    });
  }

  for (const email of adminEmails) {
    await prisma.user.upsert({
      where: { email },
      update: { role: "ADMIN", membershipType: "MEMBER", membershipStatus: "VERIFIED" },
      create: {
        email,
        name: "Admin",
        role: "ADMIN",
        membershipType: "MEMBER",
        membershipStatus: "VERIFIED"
      }
    });
  }

  await prisma.user.upsert({
    where: { email: "mitglied@example.org" },
    update: {},
    create: {
      email: "mitglied@example.org",
      name: "Mara Mitglied",
      role: "USER",
      membershipType: "MEMBER",
      membershipStatus: "VERIFIED"
    }
  });

  await prisma.user.upsert({
    where: { email: "gast@example.org" },
    update: {},
    create: {
      email: "gast@example.org",
      name: "Gregor Gastspieler",
      role: "USER",
      membershipType: "EXTERNAL",
      membershipStatus: "VERIFIED"
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
