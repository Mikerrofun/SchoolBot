// Типы для middleware защиты от дублей и in-flight лока.

export type UpdateIdEntry = {
  timestamp: number;
};

export type ChatLock = {
  since: number;
};

export type NavDedupEntry = {
  timestamp: number;
};
