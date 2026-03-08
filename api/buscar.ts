import { buscarUniversalEndpoint } from './fiscalEndpoints';

type VercelReq = {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
  url?: string;
};

type VercelRes = {
  status: (code: number) => VercelRes;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function handler(req: VercelReq, res: VercelRes) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const qFromQuery = first(req.query?.q);
  const qFromUrl = req.url ? new URL(req.url, 'http://localhost').searchParams.get('q') || undefined : undefined;

  const response = await buscarUniversalEndpoint({ q: qFromQuery || qFromUrl });
  return res.status(response.status).json(response.body);
}
