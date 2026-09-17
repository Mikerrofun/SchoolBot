// User account types (see the User model in prisma/schema.prisma).

export type UserRecord = {
  id: number;
  telegramId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  registeredAt: Date;
};
