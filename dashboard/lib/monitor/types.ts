export type Row = {
  provider: string;
  account: string;
  service: string;
  resource_id: string;
  name?: string;
  region?: string;
  status?: string;
  cost_mtd?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tags?: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw?: Record<string, any>;
};

export type Account = { name: string; token: string; provider?: string };
