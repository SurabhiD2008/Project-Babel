const prisma = require("../src/db");
prisma.aiCache.deleteMany({ where: { kind: "feeling" } }).then((r) => {
  console.log("cleared", r.count, "cached feeling responses");
  return prisma.$disconnect();
});
