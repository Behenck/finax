import { prisma } from "@/lib/prisma"
import { faker } from "@faker-js/faker"
import { hash } from "bcryptjs"
import { Role } from "generated/prisma/enums"

export async function makeUser() {
  const password = "123456"
  const passwordHash = await hash(password, 6)
  const orgName = faker.company.name()
  const slugBase = faker.helpers.slugify(orgName).toLowerCase()
  const uniqueSuffix = `${Date.now()}${Math.floor(Math.random() * 100000)}`

  const user = await prisma.user.create({
    data: {
      name: faker.person.fullName(),
      email: faker.internet.email(),
      passwordHash,
      emailVerifiedAt: new Date(),
    },
  })

  const userAndPassword = {
    password,
    ...user,
  }

  const org = await prisma.organization.create({
    data: {
      name: orgName,
      slug: `${slugBase}-${uniqueSuffix}`,
      ownerId: user.id,
      members: {
        create: {
          userId: user.id,
          role: Role.ADMIN
        }
      }
    }
  })

  return {
    user: userAndPassword,
    org,
  }
}
