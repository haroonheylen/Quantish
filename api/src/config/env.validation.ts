//Validation for database url and port
export interface Env {
  DATABASE_URL: string;
  PORT: number;
}

export function validateEnv(config: Record<string, unknown>): Env {
  const databaseUrl = config.DATABASE_URL;
  //Some error handling for database_url
  if (typeof databaseUrl !== 'string' || !databaseUrl.startsWith('postgres')) {
    throw new Error('DATABASE_URL is missing or is not a Postgres connection string');
  }

  //Port error handling
  const port = Number(config.PORT ?? 3000);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('PORT must be a positive integer');
  }

  return { DATABASE_URL: databaseUrl, PORT: port };
}