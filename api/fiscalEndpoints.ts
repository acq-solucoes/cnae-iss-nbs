import {
  buscarCNAE,
  buscarNCM,
  buscarCEST,
  buscarFiscalAvancado,
  buscarPorKeyword,
  buscarNCMporCNAE,
  buscarCESTporNCM,
  buscarTributacaoNCM,
  buscarSimplesNacional,
} from '../lib/fiscalService';

type Query = Record<string, string | undefined>;

function ok(data: unknown) {
  return { status: 200, body: data };
}

function badRequest(message: string) {
  return { status: 400, body: { error: message } };
}

function serverError(error: unknown) {
  return { status: 500, body: { error: String(error) } };
}

export async function buscarCnaeEndpoint(query: Query) {
  try {
    if (!query.codigo) return badRequest('Parâmetro "codigo" é obrigatório.');
    const data = await buscarCNAE(query.codigo);
    const fiscal = await buscarFiscalAvancado({ cnaeCodigo: query.codigo });
    return ok({ cnae: data, fiscal });
  } catch (error) {
    return serverError(error);
  }
}

export async function buscarNcmEndpoint(query: Query) {
  try {
    if (!query.codigo) return badRequest('Parâmetro "codigo" é obrigatório.');
    const data = await buscarNCM(query.codigo);
    const fiscal = await buscarFiscalAvancado({ ncmCodigo: query.codigo });
    return ok({ ncm: data, fiscal });
  } catch (error) {
    return serverError(error);
  }
}

export async function buscarCestEndpoint(query: Query) {
  try {
    if (!query.codigo) return badRequest('Parâmetro "codigo" é obrigatório.');
    const data = await buscarCEST(query.codigo);
    return ok({ cest: data });
  } catch (error) {
    return serverError(error);
  }
}

export async function buscarUniversalEndpoint(query: Query) {
  try {
    const q = (query.q || '').trim();
    if (!q) return badRequest('Parâmetro "q" é obrigatório.');

    const keywords = await buscarPorKeyword(q);
    if (!keywords.length) {
      return ok({ cnae: null, ncm: null, cest: [], tributos: null, simples_nacional: [] });
    }

    const first = keywords[0] as { tipo?: string; codigo?: string };
    const tipo = (first.tipo || '').toLowerCase();
    const codigo = first.codigo || '';

    if (tipo === 'cnae') {
      const [cnae, ncmRelacionados, simples] = await Promise.all([
        buscarCNAE(codigo),
        buscarNCMporCNAE(codigo),
        buscarSimplesNacional(codigo),
      ]);

      const ncmPrincipal = ncmRelacionados[0]?.codigo || null;
      const [cest, tributos] = await Promise.all([
        ncmPrincipal ? buscarCESTporNCM(ncmPrincipal) : Promise.resolve([]),
        ncmPrincipal ? buscarTributacaoNCM(ncmPrincipal) : Promise.resolve(null),
      ]);

      return ok({
        cnae,
        ncm: ncmRelacionados,
        cest,
        tributos,
        simples_nacional: simples,
      });
    }

    const [ncm, cest, tributos] = await Promise.all([
      buscarNCM(codigo),
      buscarCESTporNCM(codigo),
      buscarTributacaoNCM(codigo),
    ]);

    return ok({
      cnae: null,
      ncm,
      cest,
      tributos,
      simples_nacional: [],
    });
  } catch (error) {
    return serverError(error);
  }
}

export async function routeFiscal(path: '/buscar-cnae' | '/buscar-ncm' | '/buscar-cest' | '/buscar', query: Query) {
  if (path === '/buscar-cnae') return buscarCnaeEndpoint(query);
  if (path === '/buscar-ncm') return buscarNcmEndpoint(query);
  if (path === '/buscar-cest') return buscarCestEndpoint(query);
  return buscarUniversalEndpoint(query);
}
