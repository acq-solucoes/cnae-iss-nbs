import assert from 'node:assert/strict';
import { detectSearchType } from '../utils/validators.js';
import { formatNcm, formatCnae, parseNcmHierarchy, parseCnaeHierarchy } from '../utils/formatters.js';

assert.equal(detectSearchType('40117000'), 'ncm');
assert.equal(detectSearchType('4011.70.00'), 'ncm');
assert.equal(detectSearchType('6201500'), 'cnae');
assert.equal(detectSearchType('6201-5/00'), 'cnae');
assert.equal(detectSearchType('máquinas agrícolas'), 'keyword');

assert.equal(formatNcm('40117000'), '4011.70.00');
assert.equal(formatCnae('6201500'), '6201-5/00');

const ncm = parseNcmHierarchy('01012100', 'Reprodutores de raça pura');
assert.equal(ncm.capitulo.codigo, '01');
assert.equal(ncm.subposicao.codigo, '0101.21');

const cnae = parseCnaeHierarchy('2813400', 'Fabricação de compressores');
assert.equal(cnae.divisao.codigo, '28');
assert.equal(cnae.subclasse.codigo, '2813-4/00');

console.log('ok');
