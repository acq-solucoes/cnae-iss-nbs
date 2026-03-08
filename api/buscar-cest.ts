import { buscarCestEndpoint } from './fiscalEndpoints';

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

  const codigoFromQuery = first(req.query?.codigo);
  const codigoFromUrl = req.url ? new URL(req.url, 'http://localhost').searchParams.get('codigo') || undefined : undefined;

  const response = await buscarCestEndpoint({ codigo: codigoFromQuery || codigoFromUrl });
  return res.status(response.status).json(response.body);
}
