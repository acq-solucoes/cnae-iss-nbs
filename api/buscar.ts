import { buscarUniversalEndpoint } from './fiscalEndpoints';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const response = await buscarUniversalEndpoint({ q: url.searchParams.get('q') || undefined });
  return Response.json(response.body, { status: response.status });
}
