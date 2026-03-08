import { buscarNcmEndpoint } from './fiscalEndpoints';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const response = await buscarNcmEndpoint({ codigo: url.searchParams.get('codigo') || undefined });
  return Response.json(response.body, { status: response.status });
}
